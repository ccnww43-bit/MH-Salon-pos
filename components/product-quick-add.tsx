"use client";

import { FormEvent, useState } from "react";
import { X, Package } from "lucide-react";
import { db, InventoryItem } from "@/lib/db";
import { logAction } from "@/lib/logger";

/**
 * Workflow-audit fix (see salon_pos_workflow_audit_report.pdf):
 * lets staff register a new catalog product directly from Purchase Orders,
 * instead of leaving the order screen to add it in Inventory first.
 *
 * Unlike CustomerQuickAdd/SupplierQuickAdd, this writes straight to
 * db.inventory (products live in their own table, not moduleRecords).
 * Cost price isn't asked here — costPrice starts at 0 and the parent
 * page (Purchase Orders) backfills it from the order's own "Unit cost"
 * field when the order is submitted, so staff don't enter it twice.
 * Current stock starts at 0; it's filled in when the PO is later marked
 * "Received" via the existing stock-in flow.
 *
 * Usage: render once at the bottom of a page, control visibility with
 * `open`, and select the newly created product via `onCreated`.
 *
 *   <ProductQuickAdd
 *     open={showQuickAddProduct}
 *     onClose={() => setShowQuickAddProduct(false)}
 *     onCreated={(p) => { ...select p.id in the page's form... }}
 *   />
 */

const EMPTY_FORM = {
  name: "",
  category: "",
  type: "Retail" as "Retail" | "Operational",
  sellingPrice: "",
};

interface ProductQuickAddProps {
  open: boolean;
  onClose: () => void;
  onCreated: (product: InventoryItem) => void;
}

export function ProductQuickAdd({
  open,
  onClose,
  onCreated,
}: ProductQuickAddProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const close = () => {
    if (saving) return;
    setForm(EMPTY_FORM);
    onClose();
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const category = form.category.trim();
    const sellingPrice = Number(form.sellingPrice);

    if (!name || !category) {
      return alert("Product name and category are required.");
    }
    if (form.sellingPrice === "" || isNaN(sellingPrice) || sellingPrice < 0) {
      return alert("Enter a valid selling price.");
    }

    setSaving(true);

    try {
      const now = new Date();

      const record: Omit<InventoryItem, "id"> = {
        type: form.type,
        name,
        category,
        costPrice: 0,
        sellingPrice,
        currentStock: 0,
        minimumStock: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.inventory.add(record as InventoryItem);

      await logAction("Inventory", `Added new product: ${name} (quick add)`);

      setForm(EMPTY_FORM);
      onCreated({ ...record, id });
    } catch (err) {
      alert("Could not save this product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6"
      onClick={close}
    >
      <div
        className="bg-white w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900"
          title="Close"
        >
          <X size={24} />
        </button>

        <h2 className="text-lg font-black text-slate-900 tracking-tighter mb-1 flex items-center gap-2">
          <Package size={20} className="text-primary" />
          Quick-Add Product
        </h2>
        <p className="text-xs text-slate-400 font-bold mb-6">
          Add the item to the catalog without leaving this order. Cost price is taken from the order's unit cost.
        </p>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Product Name
            </label>
            <input
              required
              autoFocus
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Category
            </label>
            <input
              required
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Type
            </label>
            <select
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold outline-none appearance-none"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as "Retail" | "Operational" })
              }
            >
              <option value="Retail">Retail</option>
              <option value="Operational">Operational</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Selling Price (KSh)
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary text-white py-3.5 rounded-2xl font-black shadow-high shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-60 disabled:pointer-events-none"
            >
              {saving ? "Saving..." : "Save & Select"}
            </button>

            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="px-5 rounded-2xl border border-slate-100 font-black text-slate-500 text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
