"use client";

import React, { useState } from "react";
import { db, ModuleRecord } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { logAction } from "@/lib/logger";
import { SupplierQuickAdd } from "@/components/supplier-quick-add";
import { ClipboardList, Plus, PackageCheck, AlertCircle, X, ChevronRight, ShoppingBag, Lock } from "lucide-react";
import { PermissionGuard } from "@/components/permissionguard";

export default function PurchaseOrdersPage() {
  const inventory = useLiveQuery(() => db.inventory.toArray(), []);
  const suppliers = useLiveQuery(() => db.moduleRecords.where('module').equals('supplier').toArray(), []);
  const orders = useLiveQuery(() => db.moduleRecords.where('module').equals('purchase-order').reverse().toArray(), []);

  const [form, setForm] = useState({ supplierId: '', productId: '', quantity: '', cost: '' });

  // Workflow-audit fix: lets staff register a new supplier without leaving
  // this order. `suppliers` above is a live query, so the new vendor shows
  // up in the dropdown automatically once saved — this handler just
  // selects it and closes the quick-add modal.
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const handleSupplierCreated = (s: ModuleRecord) => {
    setForm(f => ({ ...f, supplierId: String(s.id) }));
    setShowQuickAddSupplier(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = inventory?.find(i => String(i.id) === form.productId);
    const supplier = suppliers?.find(s => String(s.id) === form.supplierId);
    
    await db.moduleRecords.add({
      module: 'purchase-order',
      title: `${product?.name} via ${supplier?.title}`,
      status: 'Awaiting',
      data: { ...form, productName: product?.name, supplierName: supplier?.title },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await logAction('Procurement', `Generated Purchase Order for ${product?.name}`);
    setForm({ supplierId: '', productId: '', quantity: '', cost: '' });
    document.getElementById('po-modal')?.classList.add('hidden');
  };

  const receiveStock = async (id: number, po: any) => {
    if (!confirm('Strict Verification: Confirm physical receipt of these assets?')) return;
    const product = await db.inventory.get(Number(po.data.productId));
    if (!product) return;

    const before = product.currentStock;
    const added = Number(po.data.quantity);
    const after = before + added;

    await db.inventory.update(product.id!, { currentStock: after, updatedAt: new Date() });
    
    await db.inventoryMovements.add({
      productId: product.id!, type: 'Stock In', quantity: added, beforeQty: before,
      afterQty: after, userId: localStorage.getItem('username') || 'Admin',
      reason: 'Procurement Cycle Finalized', date: new Date()
    });

    await db.moduleRecords.update(id, { status: 'Received', updatedAt: new Date() });
    await logAction('Procurement', `Stock Received for PO #${id}: +${added} ${product.name}`);
  };

  return (
    <PermissionGuard
      permission="manage_purchase_orders"
      fallback={
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-5">
          <div className="gloss-card p-6 text-center max-w-lg">
            <div className="w-20 h-20 rounded-lg bg-danger/10 text-danger flex items-center justify-center mb-8 mx-auto">
              <Lock size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-3">Access Restricted</h2>
            <p className="text-slate-500 font-bold text-sm">You don't have permission to view this page. Contact an administrator if you believe this is a mistake.</p>
          </div>
        </div>
      }
    >
    <Navbar />
    <div className="page-shell space-y-8 selection:bg-primary">
      <div className="page-header">
        <div>
          <h1 className="page-title">Procurement</h1>
          <p className="page-subtitle">Inbound asset & stock logistics</p>
        </div>
        <button onClick={() => document.getElementById('po-modal')?.classList.remove('hidden')} className="btn btn-primary">
          <Plus size={18} /> Generate Order
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orders?.map(o => (
          <div key={o.id} className="gloss-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-default">
            <div className="flex items-center gap-10">
              <div className={`p-5 rounded-3xl shadow-inner ${o.status === 'Received' ? 'bg-success/10 text-success' : 'bg-primary/5 text-primary'}`}>
                <ShoppingBag size={32} strokeWidth={2.5}/>
              </div>
              <div>
                <div className="font-black text-slate-900 text-2xl tracking-tighter uppercase leading-none mb-2">{o.title}</div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Quantity: {o.data.quantity} Units • Net Value: KSh {Number(o.data.cost).toLocaleString()} • Dated {new Date(o.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <span className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${o.status === 'Received' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning animate-pulse'}`}>
                {o.status}
              </span>
              {o.status !== 'Received' && (
                <button onClick={() => receiveStock(o.id!, o)} className="bg-primary text-white px-4 py-4 rounded-lg font-black text-[10px] uppercase tracking-[0.2em] shadow-glow-primary hover:bg-blue-700 transition-all active-click">Verify Receipt</button>
              )}
            </div>
          </div>
        ))}
        {!orders?.length && (
          <div className="py-48 text-center bg-white rounded-xl shadow-high border border-white">
            <ClipboardList size={100} className="mx-auto text-slate-100 mb-6" />
            <h3 className="text-lg font-black text-slate-300 uppercase tracking-[0.3em]">No Procurement Activity</h3>
          </div>
        )}
      </div>

      <div id="po-modal" className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md hidden flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
          <button onClick={() => document.getElementById('po-modal')?.classList.add('hidden')} className="absolute top-12 right-12 p-2 text-slate-200 hover:text-slate-900 transition-all"><X size={40}/></button>
          <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-12 uppercase leading-none">Create Order</h2>
          <form onSubmit={handleCreate} className="space-y-8">
             <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">1. Target Vendor</label>
               <div className="flex gap-2">
                 <select required className="w-full p-6 rounded-4xl border border-slate-100 bg-slate-50 font-black text-slate-900 outline-none appearance-none" value={form.supplierId} onChange={e => setForm({...form, supplierId: e.target.value})}>
                   <option value="">Authorize Supplier...</option>
                   {suppliers?.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                 </select>
                 <button
                   type="button"
                   onClick={() => setShowQuickAddSupplier(true)}
                   className="shrink-0 btn btn-secondary"
                   title="Register a new supplier without leaving this order"
                 >
                   + New
                 </button>
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">2. Catalog Item</label>
               <select required className="w-full p-6 rounded-4xl border border-slate-100 bg-slate-50 font-black text-slate-900 outline-none appearance-none" value={form.productId} onChange={e => setForm({...form, productId: e.target.value})}>
                 <option value="">Identify Asset...</option>
                 {inventory?.map(i => <option key={i.id} value={i.id}>{i.name} (Now: {i.currentStock})</option>)}
               </select>
             </div>
             <div className="grid grid-cols-2 gap-8 pt-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">Total Volume</label>
                 <input type="number" required className="w-full p-6 rounded-4xl border border-slate-100 bg-slate-50 font-black outline-none" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">Unit cost (KSh)</label>
                 <input type="number" required className="w-full p-6 rounded-4xl border border-slate-100 bg-slate-50 font-black outline-none" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} />
               </div>
             </div>
             <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-xl font-black text-xl shadow-high hover:scale-[1.02] transition-all uppercase tracking-widest mt-6">Authorize Order</button>
          </form>
        </div>
      </div>
    </div>

    <SupplierQuickAdd
      open={showQuickAddSupplier}
      onClose={() => setShowQuickAddSupplier(false)}
      onCreated={handleSupplierCreated}
    />
    </PermissionGuard>
  );
}
