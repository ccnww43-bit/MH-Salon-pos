"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db, SaleItem, SalePayment, InventoryItem, Service, Permission, HeldSale, Sale } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { PermissionGuard } from "@/components/permissionguard";
import { logAction } from "@/lib/logger";
import { hasPermission, getPermissions } from "@/lib/permissions";
import { verifyPassword, hashPassword } from "@/lib/security";
import {
  Search, ShoppingCart, User, Trash2, Plus, Minus, X, Tag, ChevronRight, UserCheck, Package, Scissors, CreditCard, DollarSign, Lock, Zap, PauseCircle, ListChecks, PlayCircle, Printer, CheckCircle2, Landmark, AlertTriangle, LayoutGrid
} from "lucide-react";

// Deterministic color per catalog category, used for the small icon badge on
// each catalog card and the category filter chips. Purely presentational —
// does not affect pricing, search, or any cart/checkout logic below.
const CATEGORY_PALETTE = [
  { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-100", chipActive: "bg-blue-600 text-white border-blue-600" },
  { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100", chipActive: "bg-emerald-600 text-white border-emerald-600" },
  { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-100", chipActive: "bg-violet-600 text-white border-violet-600" },
  { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100", chipActive: "bg-amber-600 text-white border-amber-600" },
  { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-100", chipActive: "bg-rose-600 text-white border-rose-600" },
  { bg: "bg-cyan-50", text: "text-cyan-600", ring: "ring-cyan-100", chipActive: "bg-cyan-600 text-white border-cyan-600" },
];

const categoryStyle = (category?: string) => {
  const key = category || "General";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
};

// Icon + accent shown next to each payment method in the segmented method
// picker below. Purely presentational — the underlying value is still the
// exact same string used everywhere else (Sale records, vouchers, etc).
const PAYMENT_METHOD_META: Record<string, { icon: React.ElementType; label: string }> = {
  "Cash": { icon: DollarSign, label: "Cash" },
  "M-Pesa": { icon: Zap, label: "M-Pesa" },
  "Card": { icon: CreditCard, label: "Card" },
  "Bank Transfer": { icon: Landmark, label: "Bank" },
  "Voucher": { icon: Tag, label: "Voucher" },
};
const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_META) as SalePayment["method"][];

export default function POSPage() {
  const services = useLiveQuery(() => db.services.filter(s => s.isActive).toArray(), []);
  const inventory = useLiveQuery(() => db.inventory.filter(i => i.isActive && i.type === 'Retail').toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  // Real Staff profiles (HR module), NOT login accounts — this is who
  // commission and clinical records need to attach to. A profile's
  // `data.userId` optionally links it to a login account, but that's a
  // separate concern from who actually performed the service.
  const staff = useLiveQuery(() => db.moduleRecords.where('module').equals('staff').and(s => s.status === 'Active').toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const promotions = useLiveQuery(() => db.moduleRecords.where('module').equals('promotion').toArray(), []);
  const memberships = useLiveQuery(() => db.moduleRecords.where('module').equals('membership').toArray(), []);
  const heldSales = useLiveQuery(() => db.heldSales.orderBy('createdAt').reverse().toArray(), []);

  const [tab, setTab] = useState<'Services' | 'Products'>('Services');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [query, setQuery] = useState("");
  // Barcode scan-to-add: a scanner behaves like a keyboard typing the code
  // fast, then Enter. Looks up `barcode` first, falling back to `sku`, so it
  // works whether the code is a manufacturer barcode or a self-printed
  // label built from the internal SKU.
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [payments, setPayments] = useState<SalePayment[]>([{ method: "Cash", amount: 0, date: new Date() }]);
  const [discount, setDiscount] = useState(0);
  // Tip/gratuity — added on top of the total, kept out of the tax and
  // discount math (tips aren't taxed or discounted).
  const [tip, setTip] = useState(0);
  const [tipInput, setTipInput] = useState("");
  const [processing, setProcessing] = useState(false);

  // Discount authorization
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[] | undefined>(undefined);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmountInput, setDiscountAmountInput] = useState("");
  const [managerUsername, setManagerUsername] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Hold / Resume Sale
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Receipt printing: holds the just-completed sale so a "Sale complete"
  // modal can offer a Print receipt option right after checkout, instead of
  // requiring a trip to the Transactions page.
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const printReceipt = () => {
    window.print();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = localStorage.getItem("userRole");
    setUserRole(role);
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

  const canApplyDiscounts = permissionsLoaded && hasPermission(userRole, 'apply_discounts', userPermissions);

  const currency = settings?.[0]?.currency || "KSh";
  const taxEnabled = !!settings?.[0]?.taxEnabled;
  const taxRate = Math.max(0, settings?.[0]?.taxRate || 0);

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  // Membership discount: a real, currently-Active membership assigned to this
  // customer (from the Memberships page) applies its percentage automatically
  // to the whole cart, the same way Promotions already apply automatically
  // per item. This stacks with (does not replace) the manual manager-approved
  // discount above, and the combined total is clamped so it can never exceed
  // the subtotal.
  const today = new Date().toISOString().split('T')[0];
  const activeMembership = selectedCustomer
    ? (memberships || []).find(m =>
        m.status === 'Active' &&
        m.customerId === selectedCustomer.id &&
        (!m.data?.expiry || m.data.expiry >= today)
      ) || null
    : null;
  const membershipDiscountPercent = activeMembership
    ? Math.min(100, Math.max(0, Number(activeMembership.data?.discount) || 0))
    : 0;
  const membershipDiscountAmount = Math.min(subtotal, (subtotal * membershipDiscountPercent) / 100);

  const totalDiscount = Math.min(subtotal, discount + membershipDiscountAmount);
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const tax = taxEnabled ? (taxableAmount * taxRate) / 100 : 0;
  const total = taxableAmount + tax + tip;
  const paid = payments.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  const balance = total - paid;

  // Keep the manual discount consistent if the cart shrinks below the current discount amount
  useEffect(() => {
    if (discount > subtotal) {
      setDiscount(Math.max(0, subtotal));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const openDiscountModal = () => {
    setDiscountAmountInput(discount ? String(discount) : "");
    setManagerUsername("");
    setManagerPassword("");
    setApprovalError("");
    setShowDiscountModal(true);
  };

  const handleApproveDiscount = async () => {
    setApprovalError("");
    const amount = Math.max(0, Math.min(subtotal, Number(discountAmountInput) || 0));

    if (!managerUsername.trim() || !managerPassword) {
      setApprovalError("Enter the manager's username and password.");
      return;
    }

    setApprovalLoading(true);
    try {
      const manager = await db.users.where('username').equalsIgnoreCase(managerUsername.trim()).first();

      if (!manager || !manager.isActive) {
        setApprovalError("Verification failed. Invalid username or password.");
        return;
      }

      let passwordOk = false;
      if (manager.passwordHash && manager.passwordSalt) {
        passwordOk = await verifyPassword(managerPassword, manager.passwordHash, manager.passwordSalt);
      } else if (manager.password) {
        // Legacy account — verify against the old plain-text value, then upgrade
        // it to a secure hash, matching the login page's migration behavior.
        passwordOk = manager.password === managerPassword;
        if (passwordOk && manager.id) {
          const { passwordHash, passwordSalt } = await hashPassword(managerPassword);
          await db.users.update(manager.id, { passwordHash, passwordSalt, password: undefined });
        }
      }

      if (!passwordOk) {
        setApprovalError("Verification failed. Invalid username or password.");
        return;
      }

      const managerPermissions = manager.role === 'Admin' ? getPermissions('Admin') : (manager.permissions ?? getPermissions(manager.role));
      if (!hasPermission(manager.role, 'apply_discounts', managerPermissions)) {
        setApprovalError(`${manager.username} is not authorized to approve discounts.`);
        return;
      }

      setDiscount(amount);
      await logAction(
        "Discount Approved",
        `Manager ${manager.username} authorized a discount of ${currency} ${amount.toLocaleString()} for cashier ${localStorage.getItem("username") || "Unknown"}.`
      );
      setShowDiscountModal(false);
    } catch (e) {
      setApprovalError("A system database error occurred. Please try again.");
    } finally {
      setApprovalLoading(false);
    }
  };

  const catalog = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (tab === 'Services') {
      return services?.filter(s => s.name.toLowerCase().includes(q) && (!categoryFilter || s.category === categoryFilter)) || [];
    }
    return inventory?.filter(i => i.name.toLowerCase().includes(q) && (!categoryFilter || i.category === categoryFilter)) || [];
  }, [tab, services, inventory, query, categoryFilter]);

  // Distinct categories for the current tab, used only to render the filter
  // chips above the catalog grid. Recomputed from the full (unsearched,
  // unfiltered) list for that tab so chips don't disappear while searching.
  const categories = useMemo(() => {
    const source = tab === 'Services' ? services : inventory;
    return Array.from(new Set((source || []).map(i => i.category).filter(Boolean))) as string[];
  }, [tab, services, inventory]);

  // Reset the category filter when switching tabs, since Services and
  // Products don't share categories.
  useEffect(() => {
    setCategoryFilter(null);
  }, [tab]);

  const catalogLoading = tab === 'Services' ? services === undefined : inventory === undefined;

  // A customer is a "debtor" whenever they have a Completed sale that isn't
  // fully paid yet. Computed live from their own sales (not a stored field
  // on the customer) so it can never drift out of sync with what
  // Transactions/Reports show — same approach used on the Customers page.
  const customerDebtSales = useLiveQuery(
    () => selectedCustomer?.id
      ? db.sales.where('customerId').equals(selectedCustomer.id).toArray()
      : Promise.resolve([] as Sale[]),
    [selectedCustomer?.id]
  );
  const customerDebt = (customerDebtSales || [])
    .filter(s => s.transactionStatus === 'Completed' && s.balance > 0)
    .reduce((sum, s) => sum + s.balance, 0);

  // Walk-in / Cash Sale: for a customer who doesn't want to give their
  // details. Reuses a single, permanent "Walk-in / Cash Customer" record
  // (creating it once, the first time it's needed) so no personal info is
  // ever required to ring up a sale.
  const WALK_IN_CUSTOMER_NAME = "Walk-in / Cash Customer";

  const selectWalkInCustomer = async () => {
    try {
      let walkIn = customers?.find(c => c.name.trim().toLowerCase() === WALK_IN_CUSTOMER_NAME.toLowerCase());

      if (!walkIn) {
        const newId = await db.customers.add({
          name: WALK_IN_CUSTOMER_NAME,
          phone: "N/A",
          email: "",
          gender: "Other",
          dob: "",
          notes: "Auto-created so cashiers can ring up walk-in / cash customers who prefer not to share personal details.",
          loyaltyPoints: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        } as any);
        walkIn = await db.customers.get(newId as number);
      }

      if (walkIn) setSelectedCustomer(walkIn);
    } catch (e) {
      alert("Could not set walk-in customer. DB Error.");
    }
  };

  // Saves the current cart, chosen customer, payment lines and discount as a
  // "Held" sale so the cashier can serve someone else and come back to it
  // later, instead of losing the in-progress ticket.
  const handleHoldSale = async () => {
    if (cart.length === 0) return alert("Add items to the cart before holding a sale.");

    try {
      const holdId = `HOLD-${Date.now().toString().slice(-6).toUpperCase()}`;

      await db.heldSales.add({
        holdId,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        cart,
        payments,
        discount,
        tip,
        cashierId: localStorage.getItem("userId") || "0",
        cashierName: localStorage.getItem("username") || "System",
        createdAt: new Date()
      });

      await logAction("Sale Held", `Held sale ${holdId} for ${selectedCustomer?.name || "no customer selected"} with ${cart.length} item(s).`);

      setCart([]);
      setSelectedCustomer(null);
      setPayments([{ method: "Cash", amount: 0, date: new Date() }]);
      setDiscount(0);
      setTip(0);
      setTipInput("");
      alert(`Sale held as ${holdId}. Resume it anytime from "Held Sales".`);
    } catch (e) {
      alert("Failed to hold sale. DB Error.");
    }
  };

  // Loads a previously held sale back into the active cart so checkout can
  // continue exactly where it left off, then removes it from the held list.
  const handleResumeHeldSale = async (held: HeldSale) => {
    if (cart.length > 0 && !confirm("Resuming this held sale will replace your current cart. Continue?")) return;

    setCart(held.cart);
    setPayments(held.payments && held.payments.length ? held.payments : [{ method: "Cash", amount: 0, date: new Date() }]);
    setDiscount(held.discount || 0);
    setTip(held.tip || 0);
    setTipInput(held.tip ? String(held.tip) : "");

    if (held.customerId) {
      const cust = customers?.find(c => c.id === held.customerId);
      setSelectedCustomer(cust || null);
    } else {
      setSelectedCustomer(null);
    }

    await db.heldSales.delete(held.id!);
    await logAction("Sale Resumed", `Resumed held sale ${held.holdId}.`);
    setShowHeldModal(false);
  };

  // Permanently discards a held sale without ringing it up.
  const handleDiscardHeldSale = async (held: HeldSale) => {
    if (!confirm(`Discard held sale ${held.holdId}? This cannot be undone.`)) return;
    await db.heldSales.delete(held.id!);
    await logAction("Held Sale Discarded", `Discarded held sale ${held.holdId} for ${held.customerName || "no customer selected"}.`);
  };

  // Finds a real, currently-Active promotion (from the Promotions page) that
  // applies to this service today, if any.
  const getActivePromotion = (serviceId: number) => {
    if (!promotions) return null;
    const today = new Date().toISOString().split('T')[0];
    return promotions.find(p =>
      p.status === 'Active' &&
      Array.isArray(p.data?.selectedServices) &&
      p.data.selectedServices.includes(serviceId) &&
      (!p.data.start || p.data.start <= today) &&
      (!p.data.end || today <= p.data.end)
    ) || null;
  };

  const addItem = (item: Service | InventoryItem, type: 'Service' | 'Product') => {
    const cartId = Math.random().toString(36).substr(2, 9);
    const basePrice = type === 'Service' ? (item as Service).price : (item as InventoryItem).sellingPrice;

    // Apply a real promotion, if one is currently active for this service,
    // so the discounted price flows straight into the cart's real totals.
    let unitPrice = basePrice;
    let displayName = item.name;
    let lineDiscount = 0;

    if (type === 'Service') {
      const promo = getActivePromotion(item.id!);
      if (promo) {
        const pct = Math.min(100, Math.max(0, Number(promo.amount) || 0));
        unitPrice = Math.max(0, basePrice - (basePrice * pct) / 100);
        lineDiscount = basePrice - unitPrice;
        displayName = `${item.name} (Promo -${pct}%)`;
      }
    }

    const newItem: SaleItem = {
      id: cartId, type, name: displayName, price: unitPrice,
      quantity: 1, discount: lineDiscount, total: unitPrice,
      serviceId: type === 'Service' ? item.id : undefined,
      productId: type === 'Product' ? item.id : undefined
    };
    setCart([...cart, newItem]);
  };

  // Looks up a scanned code against the retail catalog (barcode first, then
  // SKU) and adds it via the same addItem() path a catalog tap uses — so it
  // inherits the same promo/pricing/stock-warning behavior automatically.
  const handleBarcodeScan = () => {
    const code = barcodeInput.trim();
    if (!code) return;

    const match = inventory?.find(i =>
      (i.barcode && i.barcode.trim().toLowerCase() === code.toLowerCase()) ||
      (i.sku && i.sku.trim().toLowerCase() === code.toLowerCase())
    );

    if (!match) {
      setBarcodeError(`No product found for code "${code}".`);
      setBarcodeInput("");
      return;
    }

    setBarcodeError("");
    addItem(match, 'Product');
    setBarcodeInput("");
  };
    // Looks up every "Voucher" payment line by the code typed in, validates it
  // (exists, Active, not expired, enough balance left), and returns how much
  // to deduct from each voucher record. Multiple payment lines using the same
  // code are combined so redemption can never exceed the real balance.
  const resolveVoucherUsage = async (): Promise<{ error?: string; usage: { record: any; code: string; amount: number }[] }> => {
    const voucherPayments = payments.filter(p => p.method === "Voucher");
    if (voucherPayments.length === 0) return { usage: [] };

    const requestedByCode = new Map<string, number>();
    for (const p of voucherPayments) {
      const code = (p.reference || "").trim().toUpperCase();
      if (!code) return { usage: [], error: "Enter a voucher code for the voucher payment line." };
      if (!p.amount || p.amount <= 0) return { usage: [], error: `Enter a valid amount for voucher ${code}.` };
      requestedByCode.set(code, (requestedByCode.get(code) || 0) + p.amount);
    }

    const usage: { record: any; code: string; amount: number }[] = [];
    for (const [code, amount] of requestedByCode.entries()) {
      const voucher = await db.moduleRecords
        .where('module').equals('voucher')
        .filter(v => (v.title || "").trim().toUpperCase() === code)
        .first();

      if (!voucher) return { usage: [], error: `Voucher code "${code}" was not found.` };
      if (voucher.status !== 'Active') return { usage: [], error: `Voucher "${code}" is not active (status: ${voucher.status}).` };
      if (voucher.data?.expiry && new Date(voucher.data.expiry) < new Date()) {
        return { usage: [], error: `Voucher "${code}" expired on ${voucher.data.expiry}.` };
      }

      const available = Number(voucher.data?.balance ?? voucher.amount ?? 0);
      if (amount > available) {
        return { usage: [], error: `Voucher "${code}" only has ${currency} ${available.toLocaleString()} remaining, but ${currency} ${amount.toLocaleString()} was requested.` };
      }

      usage.push({ record: voucher, code, amount });
    }

    return { usage };
  };

  const handleCheckout = async () => {
    if (!selectedCustomer || cart.length === 0) return alert("Identify client and add items to proceed.");

    for (const item of cart) {
      if (item.type !== 'Product' || !item.productId) continue;
      const prod = inventory?.find(p => p.id === item.productId);
      const available = prod?.currentStock ?? 0;
      if (item.quantity > available) {
        return alert(`Only ${available} of "${item.name}" in stock — reduce the quantity before checking out.`);
      }
    }

    // Every Service line must have a specialist attached so commission can
    // attach to the right person — Product lines stay optional.
    const missingSpecialist = cart.find(i => i.type === 'Service' && !i.staffId);
    if (missingSpecialist) {
      return alert(`Assign a specialist to "${missingSpecialist.name}" before checkout.`);
    }

    // Card payment lines must carry the last 4 digits + approval code —
    // never a full card number.
    for (const p of payments) {
      if (p.method === "Card" && p.amount > 0) {
        const last4 = (p.cardLast4 || "").trim();
        const approval = (p.approvalCode || "").trim();
        if (!/^\d{4}$/.test(last4)) {
          return alert("Enter the card's last 4 digits (numbers only) for the Card payment line.");
        }
        if (!approval) {
          return alert("Enter the approval code for the Card payment line.");
        }
      }
    }

    const voucherCheck = await resolveVoucherUsage();
    if (voucherCheck.error) return alert(voucherCheck.error);

    if (balance > 0) {
      const label = paid <= 0 ? "Unpaid" : "Partially Paid";
      if (!confirm(`No full payment has been entered. This sale will be recorded as ${label} with a balance of ${currency} ${balance.toLocaleString()} due. Continue?`)) {
        return;
      }
    }

    setProcessing(true);
    const inv = `INV-${Date.now().toString().slice(-8).toUpperCase()}`;
    const saleRecord: Sale = {
      receiptNumber: inv, customerId: selectedCustomer.id, customerName: selectedCustomer.name,
      items: cart, subtotal, discount: totalDiscount, total, totalPaid: paid, balance, tax, tipAmount: tip,
      status: paid >= total ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid",
      transactionStatus: "Completed", payments, cashierId: localStorage.getItem("userId") || "0",
      cashierName: localStorage.getItem("username") || "System", createdAt: new Date(), updatedAt: new Date()
    };

    try {
      await db.transaction('rw', db.sales, db.inventory, db.inventoryMovements, db.cashDrawers, db.cashMovements, async () => {
        await db.sales.add(saleRecord as any);

        // Update Inventory for products, and log each change in Inventory Movements
        // so the sale is traceable (same record shape Purchase Orders already uses).
        for (const item of cart) {
          if (item.type === 'Product' && item.productId) {
            const prod = await db.inventory.get(item.productId);
            if (prod) {
              const before = prod.currentStock;
              const after = before - item.quantity;

              await db.inventory.update(item.productId, { currentStock: after, updatedAt: new Date() });

              await db.inventoryMovements.add({
                productId: item.productId,
                type: 'Sale',
                quantity: item.quantity,
                beforeQty: before,
                afterQty: after,
                userId: localStorage.getItem('username') || 'Admin',
                reason: `Sold on invoice ${inv}`,
                date: new Date()
              });
            }
          }
        }

        // If the cash drawer is currently open, record this sale's cash
        // portion as an "IN" movement so the Cash Drawer page's balance
        // reflects real POS cash sales, not just manually-entered movements.
        const cashReceived = payments.filter(p => p.method === 'Cash').reduce((sum, p) => sum + p.amount, 0);
        if (cashReceived > 0) {
          const openDrawers = await db.cashDrawers.where('status').equals('Open').toArray();
          const openDrawer = [...openDrawers].sort(
            (a: any, b: any) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
          )[0];

          if (openDrawer) {
            await db.cashMovements.add({
              drawerId: openDrawer.id,
              type: 'IN',
              amount: cashReceived,
              reason: `Cash sale ${inv}`,
              date: new Date(),
              username: localStorage.getItem('username') || 'System'
            } as any);
          }
        }
      });

      // Deduct the redeemed amount from each voucher's real balance, and mark
      // it Redeemed once fully used so it can never be spent twice.
      for (const { record, amount } of voucherCheck.usage) {
        const newBalance = Number(record.data?.balance ?? record.amount ?? 0) - amount;
        await db.moduleRecords.update(record.id!, {
          amount: newBalance,
          status: newBalance <= 0 ? 'Redeemed' : 'Active',
          data: { ...record.data, balance: newBalance },
          updatedAt: new Date()
        });
      }

      const voucherSummary = voucherCheck.usage.length > 0
        ? ` Voucher(s) redeemed: ${voucherCheck.usage.map(u => `${u.code} (${currency} ${u.amount.toLocaleString()})`).join(', ')}.`
        : '';

      const promoItems = cart.filter(i => i.discount > 0);
      const promoSummary = promoItems.length > 0
        ? ` Promotion(s) applied: ${promoItems.map(i => `${i.name} (-${currency} ${i.discount.toLocaleString()})`).join(', ')}.`
        : '';

      const membershipSummary = activeMembership && membershipDiscountAmount > 0
        ? ` Membership discount applied: ${activeMembership.data?.plan || activeMembership.title} (-${currency} ${membershipDiscountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}).`
        : '';

      // Award loyalty points using the configured "points per currency spent"
      // rate, on the taxed sale amount excluding tip. No-op if no rate is
      // configured or the customer has no id (shouldn't happen post-checkout).
      let pointsEarned = 0;
      if (selectedCustomer.id) {
        const loyaltySettings = await db.moduleRecords
          .where('module').equals('loyalty')
          .filter(r => r.title === '__loyalty_settings__')
          .first();
        const pointsPerCurrency = Number(loyaltySettings?.data?.pointsPerCurrency) || 0;

        if (pointsPerCurrency > 0) {
          const earnableAmount = Math.max(0, total - tip);
          pointsEarned = Math.round(earnableAmount * pointsPerCurrency * 100) / 100;

          if (pointsEarned > 0) {
            const custRow = await db.customers.get(selectedCustomer.id);
            const previousBalance = custRow?.loyaltyPoints || 0;
            const newBalance = previousBalance + pointsEarned;

            await db.customers.update(selectedCustomer.id, { loyaltyPoints: newBalance, updatedAt: new Date() });
            await db.moduleRecords.add({
              module: 'loyalty',
              title: 'Points Earned',
              status: 'Earned',
              customerId: selectedCustomer.id,
              amount: pointsEarned,
              data: { reason: `Earned on sale ${inv}`, previousBalance, newBalance },
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      }
      const loyaltySummary = pointsEarned > 0 ? ` Loyalty points earned: ${pointsEarned}.` : '';

      await logAction("POS Sale", `Authorized ${inv} for ${selectedCustomer.name}. Total: ${total}. Discount applied: ${currency} ${totalDiscount.toLocaleString()}. Tax: ${currency} ${tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}.${voucherSummary}${promoSummary}${membershipSummary}${loyaltySummary}`);
      setCart([]); setSelectedCustomer(null); setPayments([{ method: "Cash", amount: 0, date: new Date() }]); setDiscount(0);
      setTip(0); setTipInput("");
      setCompletedSale(saleRecord);
    } catch (e) { alert("Checkout failed. DB Error."); }
    finally { setProcessing(false); }
  };

  return (
    <PermissionGuard permission="access_pos">
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-slate-50">
      {/* Left: Catalog */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="shrink-0 px-6 py-4 bg-white border-b border-slate-200 shadow-premium flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><ShoppingCart size={20}/></div>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button onClick={() => setTab('Services')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === 'Services' ? 'bg-white text-slate-900 shadow-premium' : 'text-slate-500 hover:text-slate-700'}`}>
                <Scissors size={14}/> Services
              </button>
              <button onClick={() => setTab('Products')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === 'Products' ? 'bg-white text-slate-900 shadow-premium' : 'text-slate-500 hover:text-slate-700'}`}>
                <Package size={14}/> Products
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full xl:w-auto">
            <button onClick={() => setShowHeldModal(true)} className="relative flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-premium hover:border-primary/30 hover:shadow-high transition-all text-sm font-semibold text-slate-600 hover:text-slate-900">
              <ListChecks size={16}/> Held sales
              {!!heldSales?.length && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] min-w-[18px] px-1 flex items-center justify-center shadow-glow-primary">{heldSales.length}</span>
              )}
            </button>
            <div className="relative flex-1 xl:w-72 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder={`Search ${tab.toLowerCase()}`} className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="relative flex-1 xl:w-56 group">
              <Zap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                placeholder="Scan barcode..."
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all"
                value={barcodeInput}
                onChange={e => { setBarcodeInput(e.target.value); if (barcodeError) setBarcodeError(""); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeScan(); } }}
              />
            </div>
          </div>
        </div>
        {barcodeError && (
          <div className="shrink-0 px-6 py-2 bg-danger/10 border-b border-danger/20 text-danger text-xs font-bold">{barcodeError}</div>
        )}

        {categories.length > 0 && (
          <div className="shrink-0 px-6 py-3 bg-white/60 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${!categoryFilter ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
            >
              <LayoutGrid size={12}/> All
            </button>
            {categories.map(cat => {
              const style = categoryStyle(cat);
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(active ? null : cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active ? style.chipActive : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {catalogLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-[132px] rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {catalog.map(item => {
                const promo = tab === 'Services' ? getActivePromotion(item.id!) : null;
                const basePrice = tab === 'Services' ? (item as Service).price : (item as InventoryItem).sellingPrice;
                const promoPct = promo ? Math.min(100, Math.max(0, Number(promo.amount) || 0)) : 0;
                const promoPrice = promo ? Math.max(0, basePrice - (basePrice * promoPct) / 100) : null;
                const style = categoryStyle(item.category);

                return (
                  <button key={item.id} onClick={() => addItem(item as any, tab === 'Services' ? 'Service' : 'Product')} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-premium hover:shadow-high hover:border-primary/30 hover:-translate-y-0.5 active:scale-[0.98] text-left transition-all group relative">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${style.bg} ${style.text} ring-4 ${style.ring} shrink-0`}>
                        {tab === 'Services' ? <Scissors size={14}/> : <Package size={14}/>}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right leading-tight pt-1">{item.category}</span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm leading-snug mb-3 line-clamp-2 min-h-[2.5em]">{item.name}</div>
                    <div className="flex items-center justify-between">
                      {promo ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] text-slate-400 line-through">{currency} {basePrice.toLocaleString()}</span>
                          <span className="text-base font-black text-primary">{currency} {promoPrice!.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-base font-black text-slate-900">{currency} {basePrice.toLocaleString()}</span>
                      )}
                      {promo && (
                        <span className="text-[10px] font-bold text-white bg-primary px-1.5 py-0.5 rounded-md shadow-glow-primary">-{promoPct}%</span>
                      )}
                    </div>
                    {tab === 'Products' && (() => {
                      const stock = (item as InventoryItem).currentStock;
                      const minStock = (item as InventoryItem).minimumStock;
                      if (stock <= 0) {
                        return <div className="mt-2 text-[9px] font-black text-danger uppercase tracking-widest">Out of stock</div>;
                      }
                      if (stock <= minStock) {
                        return <div className="mt-2 text-[9px] font-black text-warning uppercase tracking-widest">Low stock: {stock}</div>;
                      }
                      return null;
                    })()}
                  </button>
                );
              })}
              {catalog.length === 0 && (
                <div className="col-span-full py-3 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                    {tab === 'Services' ? <Scissors size={20}/> : <Package size={20}/>}
                  </div>
                  <span className="text-sm text-slate-400">No {tab.toLowerCase()} match your search.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Checkout */}
      <div className="w-full lg:w-[400px] bg-white border-l border-slate-200 shadow-high flex flex-col shrink-0">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#07101c] text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart size={15} className="text-yellow-300"/>
            <span className="text-[12px] font-black uppercase tracking-[0.1em]">Checkout</span>
          </div>
          {cart.length > 0 && (
            <span className="text-[10px] font-bold bg-white/10 rounded-full px-2 py-0.5">{cart.length} item{cart.length === 1 ? '' : 's'}</span>
          )}
        </div>

        <div className="shrink-0 px-4 py-3 border-b border-slate-200">
          {selectedCustomer ? (
            <div className="bg-slate-900 p-3.5 rounded-2xl shadow-inner-light space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"><User size={15}/></div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm leading-tight truncate">{selectedCustomer.name}</div>
                    <div className="text-white/50 text-xs leading-tight">{selectedCustomer.phone}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-white/40 hover:text-white p-1 transition-colors shrink-0"><X size={16}/></button>
              </div>
              {customerDebt > 0 && (
                <div className="flex justify-between items-center bg-rose-500/10 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-1.5 text-rose-300 text-xs font-semibold">
                    <AlertTriangle size={12}/> Debtor: owes {currency} {customerDebt.toLocaleString()}
                  </div>
                </div>
              )}
              {activeMembership && (
                <div className="flex justify-between items-center bg-white/5 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-1.5 text-white/60 text-xs">
                    <Tag size={12}/> {activeMembership.data?.plan || activeMembership.title}
                  </div>
                  <span className="text-primary text-xs font-semibold">-{membershipDiscountPercent}%</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 block">Client</label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all" value="" onChange={e => setSelectedCustomer(customers?.find(c => String(c.id) === e.target.value))}>
                  <option value="">Select client...</option>
                  {customers?.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                </select>
              </div>
              <button onClick={selectWalkInCustomer} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors text-xs font-semibold">
                <Zap size={14}/> Walk-in / cash sale
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto app-scroll">
        <div className="px-4 py-3 space-y-2">
          {cart.map(item => (
            <div key={item.id} className="p-3 rounded-2xl border border-slate-200 shadow-premium hover:shadow-high transition-shadow">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="min-w-0">
                   <div className="text-[10px] font-bold text-primary/70 uppercase tracking-wide">{item.type}</div>
                   <div className="font-semibold text-slate-900 text-sm leading-snug">{item.name}</div>
                </div>
                <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-danger p-0.5 transition-colors shrink-0"><Trash2 size={15}/></button>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl">
                  <button onClick={() => {
                    const nQty = Math.max(1, item.quantity - 1);
                    setCart(cart.map(i => i.id === item.id ? {...i, quantity: nQty, total: nQty * i.price} : i));
                  }} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"><Minus size={12}/></button>
                  <span className="font-bold text-sm px-2 min-w-[28px] text-center">{item.quantity}</span>
                  <button onClick={() => {
                    const nQty = item.quantity + 1;
                    setCart(cart.map(i => i.id === item.id ? {...i, quantity: nQty, total: nQty * i.price} : i));
                  }} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"><Plus size={12}/></button>
                </div>
                <div className="text-sm font-black text-slate-900">{currency} {item.total.toLocaleString()}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100">
                 <select
                   className={`w-full bg-transparent text-xs font-medium outline-none cursor-pointer ${item.type === 'Service' && !item.staffId ? 'text-danger font-bold' : 'text-slate-400'}`}
                   value={item.staffId || ""}
                   onChange={e => {
                     const st = staff?.find(s => String(s.id) === e.target.value);
                     setCart(cart.map(i => i.id === item.id ? {...i, staffId: st?.id, staffName: st?.title} : i));
                   }}
                 >
                   <option value="">{item.type === 'Service' ? 'Assign specialist (required)' : 'Assign specialist (optional)'}</option>
                   {staff?.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                 </select>
                 {item.type === 'Product' && (() => {
                   const prod = inventory?.find(p => p.id === item.productId);
                   if (!prod) return null;
                   if (prod.currentStock <= 0) {
                     return <div className="mt-1.5 text-[10px] font-bold text-danger uppercase tracking-wide">Out of stock — only {prod.currentStock} on hand</div>;
                   }
                   if (item.quantity > prod.currentStock) {
                     return <div className="mt-1.5 text-[10px] font-bold text-warning uppercase tracking-wide">Only {prod.currentStock} in stock — exceeds available</div>;
                   }
                   if (prod.currentStock <= prod.minimumStock) {
                     return <div className="mt-1.5 text-[10px] font-bold text-warning uppercase tracking-wide">Low stock: {prod.currentStock} left</div>;
                   }
                   return null;
                 })()}
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                <ShoppingCart size={28} strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-slate-400">Cart is empty</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white">
          <div className="px-4 py-3 space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><Tag size={12}/> Discount</span>
              {!canApplyDiscounts && (
                <button onClick={openDiscountModal} className="text-warning hover:text-warning/80 transition-colors flex items-center gap-1 font-bold bg-warning/10 rounded-full px-2 py-1">
                  <Lock size={11}/> Manager approval
                </button>
              )}
            </div>
            {canApplyDiscounts ? (
              <input
                type="number" min={0} max={subtotal} placeholder="0"
                className="border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm p-2.5 w-full text-right outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={discount || ""}
                onChange={e => setDiscount(Math.max(0, Math.min(subtotal, Number(e.target.value) || 0)))}
              />
            ) : (
              discount > 0 && (
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <span className="text-slate-900 font-semibold text-sm">-{currency} {discount.toLocaleString()}</span>
                  <button onClick={() => setDiscount(0)} className="text-slate-400 hover:text-danger p-0.5 transition-colors"><X size={14}/></button>
                </div>
              )
            )}

            {activeMembership && membershipDiscountAmount > 0 && (
              <div className="flex justify-between items-center text-sm">
                 <span className="text-xs font-medium text-slate-500">{activeMembership.data?.plan || activeMembership.title} (-{membershipDiscountPercent}%)</span>
                 <span className="text-slate-900 font-semibold">-{currency} {membershipDiscountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            )}

            {taxEnabled && (
              <div className="flex justify-between items-center text-sm">
                 <span className="text-xs font-medium text-slate-500">Tax ({taxRate}%)</span>
                 <span className="text-slate-900 font-semibold">{currency} {tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                <span>Tip / Gratuity</span>
                {tip > 0 && (
                  <button onClick={() => { setTip(0); setTipInput(""); }} className="text-slate-400 hover:text-danger transition-colors font-bold">Clear</button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {[10, 15, 20].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => { const amt = Math.round((subtotal * pct) / 100 * 100) / 100; setTip(amt); setTipInput(String(amt)); }}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
                <input
                  type="number" min={0} placeholder="0"
                  className="flex-[1.4] border border-slate-200 rounded-lg text-slate-900 font-semibold text-sm p-1.5 text-right outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={tipInput}
                  onChange={e => {
                    setTipInput(e.target.value);
                    setTip(Math.max(0, Number(e.target.value) || 0));
                  }}
                />
              </div>
            </div>

            <div className="pt-1 space-y-2.5">
               <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>Payment</span>
                  <button onClick={() => setPayments([...payments, { method: "M-Pesa", amount: 0, date: new Date() }])} className="text-primary hover:text-primary/80 transition-colors font-bold">+ Add split</button>
               </div>
               {payments.map((p, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-3 gap-1 grow">
                        {PAYMENT_METHODS.map(method => {
                          const meta = PAYMENT_METHOD_META[method];
                          const Icon = meta.icon;
                          const active = p.method === method;
                          return (
                            <button
                              key={method}
                              type="button"
                              onClick={() => {
                                const n = [...payments]; n[idx].method = method; setPayments(n);
                              }}
                              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition-all ${active ? 'bg-primary text-white shadow-glow-primary' : 'bg-white text-slate-500 border border-slate-200 hover:border-primary/40 hover:text-primary'}`}
                            >
                              <Icon size={13}/>
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                      {payments.length > 1 && <button onClick={() => setPayments(payments.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-danger p-1 ml-1.5 shrink-0"><X size={14}/></button>}
                    </div>
                    <input type="number" placeholder="0" className="border border-slate-200 rounded-xl bg-white text-slate-900 font-semibold text-sm p-2 w-full text-right outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={p.amount || ""} onChange={e => {
                      const n = [...payments]; n[idx].amount = Number(e.target.value); setPayments(n);
                    }} />
                    {p.method === "Voucher" && (
                      <input
                        type="text"
                        placeholder="Voucher code"
                        className="border border-slate-200 rounded-xl bg-white text-slate-900 text-xs uppercase p-2 w-full outline-none focus:ring-2 focus:ring-primary/20 transition-all tracking-wide"
                        value={p.reference || ""}
                        onChange={e => {
                          const n = [...payments]; n[idx].reference = e.target.value.toUpperCase(); setPayments(n);
                        }}
                      />
                    )}
                    {p.method === "Card" && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Last 4 digits"
                          className="border border-slate-200 rounded-xl bg-white text-slate-900 text-xs p-2 w-full outline-none focus:ring-2 focus:ring-primary/20 transition-all tracking-wide"
                          value={p.cardLast4 || ""}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                            const n = [...payments]; n[idx].cardLast4 = digits; setPayments(n);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Approval code"
                          className="border border-slate-200 rounded-xl bg-white text-slate-900 text-xs uppercase p-2 w-full outline-none focus:ring-2 focus:ring-primary/20 transition-all tracking-wide"
                          value={p.approvalCode || ""}
                          onChange={e => {
                            const n = [...payments]; n[idx].approvalCode = e.target.value.toUpperCase(); setPayments(n);
                          }}
                        />
                      </div>
                    )}
                  </div>
               ))}
            </div>

            <div className="pt-3 mt-1 border-t-2 border-slate-100 flex justify-between items-end">
               <div>
                  <div className="text-xs font-semibold text-slate-500 leading-none mb-1.5">Total</div>
                  <div className="text-lg font-black text-slate-900 leading-none tracking-tight">{currency} {total.toLocaleString()}</div>
               </div>
               <div className="text-right">
                  <div className="text-xs font-semibold text-slate-500 leading-none mb-1.5">{paid >= total ? 'Status' : 'Balance due'}</div>
                  <div className={`text-xs font-bold leading-none rounded-full px-2.5 py-1.5 ${balance > 0 ? "text-danger bg-danger/10" : "text-success bg-success/10"}`}>
                    {balance > 0 ? `${currency} ${balance.toLocaleString()}` : 'Paid in full'}
                  </div>
               </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleHoldSale} disabled={cart.length === 0} className="flex-1 bg-white border border-slate-200 shadow-premium text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                 <PauseCircle size={15}/> Hold
              </button>
              <button onClick={handleCheckout} disabled={processing || cart.length === 0} className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-glow-primary hover:bg-primary/90 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed">
                 {processing ? "Processing..." : <>Charge {currency} {total.toLocaleString()} <ChevronRight size={16}/></>}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {showDiscountModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-6">
          <div className="bg-white rounded-2xl shadow-high p-6 w-full max-w-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-warning/10 rounded-xl text-warning"><Lock size={18}/></div>
              <div>
                <div className="font-bold text-slate-900 text-base leading-tight">Manager approval</div>
                <div className="text-xs text-slate-500 mt-0.5">Required to authorize this discount</div>
              </div>
            </div>

            {approvalError && (
              <div className="bg-danger/10 text-danger text-xs font-medium p-3 rounded-xl border border-danger/20">{approvalError}</div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Discount amount ({currency})</label>
                <input
                  type="number" min={0} max={subtotal} autoFocus
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={discountAmountInput}
                  onChange={e => setDiscountAmountInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Manager username</label>
                <input
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={managerUsername}
                  onChange={e => setManagerUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Manager password</label>
                <input
                  type="password"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={managerPassword}
                  onChange={e => setManagerPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleApproveDiscount(); }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowDiscountModal(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                disabled={approvalLoading}
                onClick={handleApproveDiscount}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-primary shadow-glow-primary hover:bg-primary/90 transition-colors disabled:bg-slate-300 disabled:shadow-none"
              >
                {approvalLoading ? "Verifying..." : "Authorize"}
              </button>
            </div>
          </div>
        </div>
      )}


      {showHeldModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-6">
          <div className="bg-white rounded-2xl shadow-high p-6 w-full max-w-lg max-h-[80vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><ListChecks size={18}/></div>
                <div>
                  <div className="font-bold text-slate-900 text-base leading-tight">Held sales</div>
                  <div className="text-xs text-slate-500 mt-0.5">Resume a parked ticket</div>
                </div>
              </div>
              <button onClick={() => setShowHeldModal(false)} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {!heldSales?.length && (
                <div className="py-3 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-300"><ListChecks size={20}/></div>
                  <span className="text-sm text-slate-400">No held sales</span>
                </div>
              )}
              {heldSales?.map(held => {
                const heldTotal = held.cart.reduce((sum, i) => sum + i.total, 0);
                return (
                  <div key={held.id} className="border border-slate-200 rounded-2xl shadow-premium hover:shadow-high transition-shadow p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm leading-tight mb-0.5">{held.holdId}</div>
                      <div className="text-xs text-slate-500 leading-tight mb-0.5 truncate">{held.customerName || "No customer selected"} &middot; {held.cart.length} item(s) &middot; {currency} {heldTotal.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-400">{new Date(held.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleResumeHeldSale(held)} className="p-2 rounded-xl bg-primary text-white shadow-glow-primary hover:bg-primary/90 transition-colors" title="Resume"><PlayCircle size={16}/></button>
                      <button onClick={() => handleDiscardHeldSale(held)} className="p-2 rounded-xl border border-slate-200 text-danger hover:bg-danger/5 transition-colors" title="Discard"><Trash2 size={16}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {completedSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-6">
          <div className="bg-white rounded-2xl shadow-high p-6 w-full max-w-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-success/10 rounded-xl text-success ring-4 ring-success/5"><CheckCircle2 size={20}/></div>
              <div>
                <div className="font-bold text-slate-900 text-base leading-tight">Sale complete</div>
                <div className="text-xs text-slate-500 mt-0.5">{completedSale.receiptNumber}</div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Customer</span><span className="text-slate-900 font-semibold">{completedSale.customerName}</span></div>
              <div className="flex justify-between text-slate-500"><span>Items</span><span className="text-slate-900 font-semibold">{completedSale.items.length}</span></div>
              <div className="flex justify-between items-center text-slate-500 pt-2 mt-1.5 border-t border-slate-200"><span>Total</span><span className="text-slate-900 font-black text-lg">{currency} {completedSale.total.toLocaleString()}</span></div>
              <div className="flex justify-between items-center text-slate-500">
                <span>{completedSale.balance > 0 ? 'Balance due' : 'Status'}</span>
                <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${completedSale.balance > 0 ? 'text-danger bg-danger/10' : 'text-success bg-success/10'}`}>
                  {completedSale.balance > 0 ? `${currency} ${completedSale.balance.toLocaleString()}` : 'Paid in full'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setCompletedSale(null)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors">
                New sale
              </button>
              <button onClick={printReceipt} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-primary shadow-glow-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Printer size={15}/> Print receipt
              </button>
            </div>
          </div>

          {/* Printable receipt — invisible on screen, shown only by @media print
              rules in globals.css when the Print receipt button calls window.print(). */}
          <div className="receipt-print-area hidden">
            <div style={{ fontFamily: 'monospace', maxWidth: '320px', margin: '0 auto', padding: '16px', color: '#000' }}>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{settings?.[0]?.salonName || 'Salon'}</div>
                {settings?.[0]?.address && <div>{settings[0].address}</div>}
                {settings?.[0]?.phone && <div>{settings[0].phone}</div>}
              </div>

              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', margin: '8px 0' }}>
                <div>Receipt: {completedSale.receiptNumber}</div>
                <div>Date: {new Date(completedSale.createdAt).toLocaleString()}</div>
                <div>Customer: {completedSale.customerName}</div>
                <div>Served by: {completedSale.cashierName}</div>
              </div>

              {completedSale.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{i.name} x{i.quantity}{i.staffName ? ` (${i.staffName})` : ''}</span>
                  <span>{currency} {i.total.toLocaleString()}</span>
                </div>
              ))}

              <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{currency} {completedSale.subtotal.toLocaleString()}</span></div>
                {completedSale.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-{currency} {completedSale.discount.toLocaleString()}</span></div>
                )}
                {completedSale.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>{currency} {completedSale.tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                )}
                {!!completedSale.tipAmount && completedSale.tipAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tip</span><span>{currency} {completedSale.tipAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}><span>Total</span><span>{currency} {completedSale.total.toLocaleString()}</span></div>
              </div>

              <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '8px' }}>
                {completedSale.payments.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.method}{p.method === 'Card' && p.cardLast4 ? ` (**** ${p.cardLast4})` : ''}</span>
                    <span>{currency} {p.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}><span>Balance</span><span>{currency} {completedSale.balance.toLocaleString()}</span></div>
              </div>

              {settings?.[0]?.receiptFooter && (
                <div style={{ textAlign: 'center', marginTop: '12px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
                  {settings[0].receiptFooter}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
