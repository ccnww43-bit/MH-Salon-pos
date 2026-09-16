"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { db, Sale, SalePayment } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/pagination";
import { Navbar } from "@/components/navbar";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard"; // FIXED: Added missing import
import { hasPermission } from "@/lib/permissions";
import { Permission } from "@/lib/db";
import { Receipt, Search, Eye, XCircle, RotateCcw, Printer, AlertCircle, X, ChevronRight, DollarSign, Pencil, Check } from "lucide-react";

// Wrapped in Suspense because this page reads the `?receipt=` query param
// (via useSearchParams) to auto-open an invoice when linked in from Reports —
// Next.js requires a Suspense boundary around any use of useSearchParams.
export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsPageInner />
    </Suspense>
  );
}

function TransactionsPageInner() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const size = 12;

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [actionReason, setActionReason] = useState("");

  // Deep-link support: when Reports (or anywhere else) sends the user here
  // with ?receipt=<receiptNumber>, jump straight to that invoice's detail
  // overlay instead of making them search for it.
  const searchParams = useSearchParams();
  const receiptParam = searchParams.get("receipt");
  const openedReceiptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!receiptParam || openedReceiptRef.current === receiptParam) return;
    openedReceiptRef.current = receiptParam;
    (async () => {
      const match = await db.sales.where("receiptNumber").equals(receiptParam).first();
      if (match) setSelectedSale(match);
    })();
  }, [receiptParam]);

  // Editing which specialist is credited on a line item — e.g. fixing a
  // wrong specialist picked at checkout. Admin-only (edit_transactions).
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editStaffId, setEditStaffId] = useState<string>("");

  const staff = useLiveQuery(
    () => db.moduleRecords.where("module").equals("staff").and((s: any) => s.status === "Active").toArray(),
    []
  );

  // Read directly (same pattern used in app/pos/page.tsx) rather than via
  // <PermissionGuard>, since that component renders a large spinner block
  // while it resolves — fine for a full-width button, wrong for the small
  // inline "correct specialist" icon this gates.
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[] | undefined>(undefined);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUserRole(localStorage.getItem("userRole"));
    try {
      const saved = localStorage.getItem("userPermissions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setUserPermissions(parsed);
      }
    } catch {
      setUserPermissions(undefined);
    }
    setPermissionsLoaded(true);
  }, []);

  const canEditSpecialist = permissionsLoaded && hasPermission(userRole, "edit_transactions", userPermissions);

  // Record Payment (settle an Unpaid / Partially Paid invoice)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SalePayment["method"]>("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const salonSettings = settings?.[0];
  const currency = salonSettings?.currency || "KSh";

  const printReceipt = () => {
    window.print();
  };


  const sales = useLiveQuery(async () => {
    const q = query.toLowerCase().trim();
    if (q) {
      return await db.sales
        .filter(s => s.receiptNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q))
        .reverse().offset((page - 1) * size).limit(size).toArray();
    }
    return await db.sales.reverse().offset((page - 1) * size).limit(size).toArray();
  }, [page, query]);

  const totalCount = useLiveQuery(() => db.sales.count()) || 0;

  // Restores stock for every Product line item on a sale and writes a matching
  // inventoryMovements entry (same shape Purchase Orders already uses), so a
  // void/refund is visible in the Inventory Movements log. Only ever called
  // from inside the same transaction that flips the sale to Voided/Refunded,
  // so it can never run twice for the same sale.
  const restoreInventoryForSale = async (sale: Sale, actionLabel: 'Void' | 'Refund', reason: string) => {
    for (const item of sale.items) {
      if (item.type !== 'Product' || !item.productId) continue;

      const product = await db.inventory.get(item.productId);
      if (!product) continue;

      const before = product.currentStock;
      const after = before + item.quantity;

      await db.inventory.update(product.id!, { currentStock: after, updatedAt: new Date() });

      await db.inventoryMovements.add({
        productId: product.id!,
        type: 'Return',
        quantity: item.quantity,
        beforeQty: before,
        afterQty: after,
        userId: localStorage.getItem('username') || 'Admin',
        reason: `${actionLabel} of ${sale.receiptNumber}: ${reason}`,
        date: new Date()
      });
    }
  };

  // Restores any Customer Credit or Voucher balance spent on this sale, so a
  // void/refund gives back exactly what it took. Mirrors, in reverse, the
  // deduction logic in app/pos/page.tsx's handleCheckout (creditUsed and
  // resolveVoucherUsage), so the same fields and matching rules are used.
  const restoreCreditAndVouchersForSale = async (sale: Sale) => {
    // Restore Customer Credit spent on this sale
    const creditUsed = sale.payments
      .filter(p => p.method === 'Customer Credit')
      .reduce((sum, p) => sum + p.amount, 0);

    if (creditUsed > 0) {
      const customer = await db.customers.get(sale.customerId);
      if (customer) {
        await db.customers.update(sale.customerId, {
          creditBalance: (customer.creditBalance || 0) + creditUsed,
          updatedAt: new Date()
        });
      }
    }

    // Restore Voucher balance(s) spent on this sale. Multiple payment lines
    // using the same code are combined first, same as resolveVoucherUsage
    // does when the voucher is redeemed.
    const voucherPayments = sale.payments.filter(p => p.method === 'Voucher');
    if (voucherPayments.length > 0) {
      const restoreByCode = new Map<string, number>();
      for (const p of voucherPayments) {
        const code = (p.reference || '').trim().toUpperCase();
        if (!code) continue;
        restoreByCode.set(code, (restoreByCode.get(code) || 0) + p.amount);
      }

      for (const [code, amount] of restoreByCode.entries()) {
        const voucher = await db.moduleRecords
          .where('module').equals('voucher')
          .filter(v => (v.title || '').trim().toUpperCase() === code)
          .first();

        if (!voucher) continue; // Voucher record no longer exists; nothing to restore it to.

        const newBalance = Number(voucher.data?.balance ?? voucher.amount ?? 0) + amount;
        await db.moduleRecords.update(voucher.id!, {
          amount: newBalance,
          status: 'Active',
          data: { ...voucher.data, balance: newBalance },
          updatedAt: new Date()
        });
      }
    }
  };

  // Reverses the cash portion of a sale in the currently open cash drawer, so
  // a void/refund doesn't leave the drawer showing cash that was actually
  // handed back to the customer. Mirrors, in reverse, the "IN" movement that
  // app/pos/page.tsx's handleCheckout records for the cash portion of a sale.
  // If the drawer isn't open (or was never tracking this sale), this quietly
  // does nothing — same as checkout does when there's no open drawer.
  const reverseCashMovementForSale = async (sale: Sale, actionLabel: 'Void' | 'Refund', reason: string) => {
    const cashPaid = sale.payments
      .filter(p => p.method === 'Cash')
      .reduce((sum, p) => sum + p.amount, 0);

    if (cashPaid <= 0) return;

    const openDrawers = await db.cashDrawers.where('status').equals('Open').toArray();
    const openDrawer = [...openDrawers].sort(
      (a: any, b: any) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
    )[0];

    if (!openDrawer) return;

    await db.cashMovements.add({
      drawerId: openDrawer.id,
      type: 'OUT',
      amount: cashPaid,
      reason: `${actionLabel} of ${sale.receiptNumber}: ${reason}`,
      date: new Date(),
      username: localStorage.getItem('username') || 'Admin'
    } as any);
  };

  const handleVoid = async () => {
    if (!selectedSale || !actionReason) return;
    if (!confirm("STRICT VERIFICATION: Invalidate this invoice permanently?")) return;

    await (db as any).transaction('rw', db.sales, db.inventory, db.inventoryMovements, db.customers, db.moduleRecords, db.cashDrawers, db.cashMovements, async () => {
      await db.sales.update(selectedSale.id!, {
        transactionStatus: 'Voided',
        voidReason: actionReason,
        voidedAt: new Date(),
        voidedBy: localStorage.getItem('username') || 'Admin',
        updatedAt: new Date()
      });

      await restoreInventoryForSale(selectedSale, 'Void', actionReason);
      await restoreCreditAndVouchersForSale(selectedSale);
      await reverseCashMovementForSale(selectedSale, 'Void', actionReason);
    });

    await logAction('Void', `Voided ${selectedSale.receiptNumber}. Reason: ${actionReason}. Inventory restored for any product items. Customer Credit/Voucher balances restored if used.`);
    setSelectedSale(null); setActionReason("");
  };

  // Opens the Record Payment modal for the currently selected sale, resetting
  // its fields each time so leftover values from a previous invoice never
  // carry over.
  const openPaymentModal = () => {
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setPaymentReference("");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  // Adds a new payment line to an Unpaid / Partially Paid invoice and
  // recalculates totalPaid, balance and status — the missing "clear this
  // invoice as paid later" action. Only ever enabled while the sale is still
  // Completed (not Voided/Refunded) and not already fully Paid.
  const handleRecordPayment = async () => {
    if (!selectedSale) return;
    setPaymentError("");

    const amount = Math.round((Number(paymentAmount) || 0) * 100) / 100;
    if (amount <= 0) {
      setPaymentError("Enter a valid amount.");
      return;
    }
    if (amount > selectedSale.balance) {
      setPaymentError(`Amount exceeds the outstanding balance of ${currency} ${selectedSale.balance.toLocaleString()}.`);
      return;
    }

    setPaymentProcessing(true);
    try {
      const newPayment: SalePayment = {
        method: paymentMethod,
        amount,
        reference: paymentReference.trim() || undefined,
        date: new Date()
      };

      const updatedPayments = [...selectedSale.payments, newPayment];
      const newTotalPaid = selectedSale.totalPaid + amount;
      const newBalance = Math.max(0, selectedSale.total - newTotalPaid);
      const newStatus = newBalance <= 0 ? "Paid" : "Partially Paid";

      await db.sales.update(selectedSale.id!, {
        payments: updatedPayments,
        totalPaid: newTotalPaid,
        balance: newBalance,
        status: newStatus,
        updatedAt: new Date()
      });

      await logAction(
        "Payment Recorded",
        `Recorded ${currency} ${amount.toLocaleString()} payment via ${paymentMethod} on ${selectedSale.receiptNumber}. New status: ${newStatus}. Remaining balance: ${currency} ${newBalance.toLocaleString()}.`
      );

      // Keep the open detail overlay in sync immediately, since it reads from
      // this local snapshot rather than the live query.
      setSelectedSale({
        ...selectedSale,
        payments: updatedPayments,
        totalPaid: newTotalPaid,
        balance: newBalance,
        status: newStatus,
        updatedAt: new Date()
      });
      setShowPaymentModal(false);
    } catch (e) {
      setPaymentError("A system database error occurred. Please try again.");
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Starts editing the specialist assigned to a line item in the open
  // invoice. Only ever offered while the invoice is Completed (not
  // Voided/Refunded), same rule the Audit Actions panel already uses.
  const startEditStaff = (idx: number, currentStaffId?: number) => {
    setEditingItemIdx(idx);
    setEditStaffId(currentStaffId ? String(currentStaffId) : "");
  };

  const cancelEditStaff = () => {
    setEditingItemIdx(null);
    setEditStaffId("");
  };

  // Saves the corrected specialist for one line item on the currently open
  // invoice — e.g. the wrong specialist was picked during checkout. Updates
  // db.sales directly (items array), logs it for audit, and refreshes the
  // open overlay's local snapshot immediately.
  const saveEditStaff = async (idx: number) => {
    if (!selectedSale) return;
    const newStaff = staff?.find(s => String(s.id) === editStaffId);
    const oldItem = selectedSale.items[idx];
    const oldStaffName = oldItem.staffName || "Unassigned";
    const newStaffName = newStaff?.title || "Unassigned";

    if (oldStaffName === newStaffName) {
      cancelEditStaff();
      return;
    }

    const updatedItems = selectedSale.items.map((it, i) =>
      i === idx ? { ...it, staffId: newStaff?.id, staffName: newStaff?.title } : it
    );

    await db.sales.update(selectedSale.id!, {
      items: updatedItems,
      updatedAt: new Date()
    });

    await logAction(
      "Specialist Changed",
      `Changed specialist for "${oldItem.name}" on ${selectedSale.receiptNumber} from ${oldStaffName} to ${newStaffName}.`
    );

    setSelectedSale({ ...selectedSale, items: updatedItems, updatedAt: new Date() });
    cancelEditStaff();
  };

  const handleRefund = async () => {
    if (!selectedSale || !actionReason) return;
    if (!confirm("FINANCIAL REVERSAL: Process full refund?")) return;

    await (db as any).transaction('rw', db.sales, db.inventory, db.inventoryMovements, db.customers, db.moduleRecords, db.cashDrawers, db.cashMovements, async () => {
      await db.sales.update(selectedSale.id!, {
        transactionStatus: 'Refunded',
        refundReason: actionReason,
        refundAmount: selectedSale.totalPaid,
        refundedAt: new Date(),
        refundedBy: localStorage.getItem('username') || 'Admin',
        updatedAt: new Date()
      });

      await restoreInventoryForSale(selectedSale, 'Refund', actionReason);
      await restoreCreditAndVouchersForSale(selectedSale);
      await reverseCashMovementForSale(selectedSale, 'Refund', actionReason);
    });

    await logAction('Refund', `Refunded ${selectedSale.receiptNumber}. Reason: ${actionReason}. Inventory restored for any product items. Customer Credit/Voucher balances restored if used.`);
    setSelectedSale(null); setActionReason("");
  };

  return (
    <>
    <Navbar />
    <div className="page-shell space-y-8 animate-in fade-in duration-500 selection:bg-primary">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financials</h1>
          <p className="page-subtitle">Invoice Archive &amp; Asset Reversals</p>
        </div>

        <div className="relative group w-full xl:w-[420px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-all" size={18} />
          <input placeholder="Search Reference or Client..." className="field-input w-full pl-11" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="table-card leading-none">
        <div className="table-scroll">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction</th>
              <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Customer</th>
              <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Value</th>
              <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ledger Status</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sales?.map(s => (
              <tr key={s.id} className="group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => setSelectedSale(s)}>
                <td className="px-5 py-3">
                  <div className="font-black text-slate-900 text-xl tracking-tighter leading-none mb-2 uppercase">{s.receiptNumber}</div>
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">{new Date(s.createdAt).toLocaleString()}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-black text-slate-700 text-lg tracking-tight leading-none mb-1 uppercase">{s.customerName}</div>
                  <div className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">POS Terminal #{s.cashierId}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-2xl font-black text-primary tracking-tighter leading-none">KSh {s.total.toLocaleString()}</div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                    s.transactionStatus === 'Completed' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}>{s.transactionStatus}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex p-4 rounded-2xl bg-white border border-slate-100 text-primary shadow-sm group-hover:shadow-lg group-hover:scale-110 transition-all leading-none"><ChevronRight size={24}/></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!sales?.length && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <AlertCircle size={26} />
            </div>
            <p className="empty-state-title">No records in archive</p>
          </div>
        )}
      </div>

      <Pagination totalItems={totalCount} itemsPerPage={size} currentPage={page} onPageChange={setPage} />

      {/* Detail Overlay */}
      {selectedSale && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-6xl rounded-xl shadow-high border border-white flex flex-col xl:flex-row overflow-hidden max-h-[90vh]">
              <div className="flex-1 p-6 space-y-12 overflow-y-auto no-scrollbar">
                 <div className="flex justify-between items-start">
                    <div>
                       <div className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2 leading-none">Authenticated Invoice</div>
                       <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{selectedSale.receiptNumber}</h2>
                    </div>
                    <button onClick={() => setSelectedSale(null)} className="p-4 bg-slate-50 rounded-3xl text-slate-200 hover:text-slate-900 transition-all active-click leading-none"><X size={32}/></button>
                 </div>

                 <div className="grid grid-cols-2 gap-12 border-y border-slate-50 py-3">
                    <div>
                       <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 block leading-none">Acquired by Client</label>
                       <div className="font-black text-slate-900 text-2xl tracking-tighter uppercase leading-none">{selectedSale.customerName}</div>
                    </div>
                    <div className="text-right">
                       <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 block leading-none">Settlement Status</label>
                       <div className="font-black text-success text-2xl tracking-tighter uppercase leading-none">{selectedSale.status}</div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none">Resource Consumption</label>
                    <div className="space-y-4">
                       {selectedSale.items.map((i, idx) => (
                         <div key={idx} className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100 gap-4">
                            <div className="min-w-0 flex-1">
                               <div className="font-black text-slate-900 text-xl tracking-tighter leading-none mb-2 uppercase">{i.name}</div>
                               {editingItemIdx === idx ? (
                                 <div className="flex items-center gap-2">
                                   <select
                                     autoFocus
                                     className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-4 focus:ring-primary/10"
                                     value={editStaffId}
                                     onChange={e => setEditStaffId(e.target.value)}
                                   >
                                     <option value="">Unassigned</option>
                                     {staff?.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
                                   </select>
                                   <button onClick={() => saveEditStaff(idx)} className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success hover:text-white transition-all"><Check size={14}/></button>
                                   <button onClick={cancelEditStaff} className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all"><X size={14}/></button>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2">
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Verified Provider: {i.staffName || 'N/A'}</div>
                                   {selectedSale.transactionStatus === 'Completed' && canEditSpecialist && (
                                     <button
                                       onClick={() => startEditStaff(idx, i.staffId)}
                                       className="p-1 rounded-md text-slate-300 hover:text-primary hover:bg-primary/10 transition-all"
                                       title="Correct specialist"
                                     >
                                       <Pencil size={12}/>
                                     </button>
                                   )}
                                 </div>
                               )}
                            </div>
                            <div className="text-2xl font-black text-slate-900 tracking-tighter leading-none shrink-0">KSh {i.total.toLocaleString()}</div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-slate-900 rounded-xl p-5 text-white flex justify-between items-center shadow-high mt-4">
                    <div>
                       <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-2 leading-none">Net Document Value</div>
                       <div className="text-2xl font-black tracking-tighter leading-none">KSh {selectedSale.total.toLocaleString()}</div>
                    </div>
                    <button onClick={printReceipt} className="p-6 bg-white/10 rounded-4xl hover:bg-white/20 transition-all active-click"><Printer size={32}/></button>
                 </div>
              </div>

              <div className="w-full xl:w-[420px] bg-slate-50 p-6 space-y-10 border-l border-slate-100">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Audit Actions</h3>
                 
                 {selectedSale.transactionStatus === 'Completed' ? (
                   <div className="space-y-6">
                      {selectedSale.status !== 'Paid' && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-premium space-y-5">
                           <div className="flex justify-between items-center">
                              <div>
                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Outstanding Balance</div>
                                 <div className="text-lg font-black text-danger tracking-tighter leading-none">{currency} {selectedSale.balance.toLocaleString()}</div>
                              </div>
                           </div>
                           <button onClick={openPaymentModal} className="w-full p-6 rounded-4xl bg-success text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-sm leading-none"><DollarSign size={20}/> Record Payment</button>
                        </div>
                      )}
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 leading-none">Mandatory Logic Reason</label>
                         <textarea className="w-full p-4 rounded-4xl border border-slate-200 bg-white font-bold text-sm outline-none focus:ring-8 focus:ring-primary/5 min-h-[160px] leading-relaxed transition-all" placeholder="Specify authorization reason..." value={actionReason} onChange={e => setActionReason(e.target.value)} />
                      </div>
                      <div className="space-y-3 pt-4">
                         <PermissionGuard permission="void_transactions">
                            <button onClick={handleVoid} disabled={!actionReason} className="w-full p-4 rounded-4xl bg-white border border-danger/20 text-danger font-black text-xs uppercase tracking-widest hover:bg-danger hover:text-white transition-all disabled:opacity-10 active-click flex items-center justify-center gap-3 shadow-sm leading-none"><XCircle size={20}/> Permanent Void</button>
                         </PermissionGuard>
                         <PermissionGuard permission="refund_transactions">
                            <button onClick={handleRefund} disabled={!actionReason} className="w-full p-4 rounded-4xl bg-white border border-warning/30 text-warning font-black text-xs uppercase tracking-widest hover:bg-warning hover:text-white transition-all disabled:opacity-10 active-click flex items-center justify-center gap-3 shadow-sm leading-none"><RotateCcw size={20}/> Reverse Asset</button>
                         </PermissionGuard>
                      </div>
                   </div>
                 ) : (
                   <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-premium mt-6">
                      <AlertCircle size={48} className="mx-auto text-slate-200 mb-6"/>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-loose">This document has been locked as {selectedSale.transactionStatus}. No further logic overrides permitted.</p>
                   </div>
                 )}
              </div>
           </div>

           {/* Printable receipt — invisible on screen, shown only by @media print
               rules in globals.css when the Printer button calls window.print(). */}
           <div className="receipt-print-area hidden">
             <div style={{ fontFamily: 'monospace', maxWidth: '320px', margin: '0 auto', padding: '16px', color: '#000' }}>
               <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                 <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{salonSettings?.salonName || 'Salon'}</div>
                 {salonSettings?.address && <div>{salonSettings.address}</div>}
                 {salonSettings?.phone && <div>{salonSettings.phone}</div>}
               </div>

               <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', margin: '8px 0' }}>
                 <div>Receipt: {selectedSale.receiptNumber}</div>
                 <div>Date: {new Date(selectedSale.createdAt).toLocaleString()}</div>
                 <div>Customer: {selectedSale.customerName}</div>
                 <div>Served by: {selectedSale.cashierName}</div>
                 {selectedSale.transactionStatus !== 'Completed' && (
                   <div>Status: {selectedSale.transactionStatus}</div>
                 )}
               </div>

               {selectedSale.items.map((i, idx) => (
                 <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                   <span>{i.name} x{i.quantity}{i.staffName ? ` (${i.staffName})` : ''}</span>
                   <span>{currency} {i.total.toLocaleString()}</span>
                 </div>
               ))}

               <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '8px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{currency} {selectedSale.subtotal.toLocaleString()}</span></div>
                 {selectedSale.discount > 0 && (
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-{currency} {selectedSale.discount.toLocaleString()}</span></div>
                 )}
                 {selectedSale.tax > 0 && (
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>{currency} {selectedSale.tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                 )}
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}><span>Total</span><span>{currency} {selectedSale.total.toLocaleString()}</span></div>
               </div>

               <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '8px' }}>
                 {selectedSale.payments.map((p, idx) => (
                   <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{p.method}</span><span>{currency} {p.amount.toLocaleString()}</span></div>
                 ))}
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}><span>Balance</span><span>{currency} {selectedSale.balance.toLocaleString()}</span></div>
               </div>

               {salonSettings?.receiptFooter && (
                 <div style={{ textAlign: 'center', marginTop: '12px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
                   {salonSettings.receiptFooter}
                 </div>
               )}
             </div>
           </div>
        </div>
      )}

      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[300] p-6">
          <div className="bg-white rounded-xl shadow-high p-5 w-full max-w-md space-y-6 animate-in zoom-in duration-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-2xl text-success"><DollarSign size={24}/></div>
              <div>
                <div className="font-black text-slate-900 text-xl tracking-tighter leading-none">Record Payment</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{selectedSale.receiptNumber} — Balance: {currency} {selectedSale.balance.toLocaleString()}</div>
              </div>
            </div>

            {paymentError && (
              <div className="bg-red-50 text-red-600 text-xs font-black p-4 rounded-2xl border border-red-100">{paymentError}</div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Amount Received ({currency})</label>
                <input
                  type="number" min={0} max={selectedSale.balance} autoFocus
                  className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-black text-slate-900 outline-none focus:ring-8 focus:ring-primary/5 transition-all"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Payment Method</label>
                <select
                  className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-black text-slate-900 outline-none focus:ring-8 focus:ring-primary/5 transition-all appearance-none cursor-pointer"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as SalePayment["method"])}
                >
                  <option>Cash</option><option>M-Pesa</option><option>Card</option><option>Bank Transfer</option><option>Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Reference (Optional)</label>
                <input
                  className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-black text-slate-900 outline-none focus:ring-8 focus:ring-primary/5 transition-all"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder="e.g. M-Pesa code"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-5 rounded-3xl font-black text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">
                Cancel
              </button>
              <button
                disabled={paymentProcessing}
                onClick={handleRecordPayment}
                className="flex-1 py-5 rounded-3xl font-black text-white bg-success hover:opacity-90 transition-all uppercase text-xs tracking-widest disabled:bg-slate-300"
              >
                {paymentProcessing ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
