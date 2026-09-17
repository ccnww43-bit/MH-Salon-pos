"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { X, Package, Barcode, RefreshCw, Printer, Check } from "lucide-react";
import { db, InventoryItem } from "@/lib/db";
import { logAction } from "@/lib/logger";
import { getUniqueBarcode, printBarcodeLabel } from "@/lib/barcode";

/**
 * Workflow-audit fix (see salon_pos_workflow_audit_report.pdf):
 * Purchase Orders → Product. Deliberately scoped to just what's needed
 * to continue the order — full product configuration (SKU, expiry,
 * demo flags, etc.) still lives in Inventory, per the report's caution
 * that this form should NOT try to replace that.
 *
 * Also covers the barcode workflow: scan a physical barcode straight
 * into the field, or leave it blank and one is generated automatically
 * on save. After saving, the label can be printed immediately on a
 * thermal label printer.
 *
 * Usage: render once at the bottom of a page, control visibility with
 * `open`, and select the newly created product via `onCreated`. Unlike
 * CustomerQuickAdd/SupplierQuickAdd, this modal doesn't have to be
 * closed by the caller — it manages its own "saved, want to print?"
 * step and calls `onClose` itself once the user is done.
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
  costPrice: "",
  sellingPrice: "",
  minimumStock: "5",
  barcode: "",
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
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState<InventoryItem | null>(null);

  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const currency = settings?.[0]?.currency || "KSh";

  if (!open) return null;

  const reset = () => {
    setForm(EMPTY_FORM);
    setSaved(null);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  // Lets a hardware barcode scanner (which types the code into the
  // field then sends Enter) fill this field without submitting the
  // whole form early.
  const onBarcodeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleGenerateBarcode = async () => {
    setGenerating(true);
    try {
      const code = await getUniqueBarcode();
      setForm((f) => ({ ...f, barcode: code }));
    } finally {
      setGenerating(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const category = form.category.trim();
    const costPrice = Number(form.costPrice);
    const sellingPrice = Number(form.sellingPrice);
    const minimumStock = Number(form.minimumStock) || 0;

    if (!name || !category) {
      return alert("Product name and category are required.");
    }
    if (!form.costPrice || !form.sellingPrice) {
      return alert("Cost price and selling price are required.");
    }

    setSaving(true);

    try {
      let barcode = form.barcode.trim();

      if (barcode) {
        // A scanned or hand-typed code must still be unique — otherwise
        // this product would ring up as whatever it collides with.
        const clash = await db.inventory
          .filter((i) => i.barcode === barcode)
          .first();

        if (clash) {
          alert(
            `Barcode ${barcode} is already assigned to "${clash.name}". Scan a different item or clear the field to auto-generate one.`
          );
          setSaving(false);
          return;
        }
      } else {
        // No barcode supplied — generate one so the product can still
        // be scanned at checkout and on a printed label.
        barcode = await getUniqueBarcode();
      }

      const now = new Date();

      const data: InventoryItem = {
        type: form.type,
        name,
        category,
        barcode,
        costPrice,
        sellingPrice,
        currentStock: 0,
        minimumStock,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.inventory.add(data);

      await logAction(
        "Inventory",
        `Added new product: ${name} (quick add, barcode ${barcode})`
      );

      const product = { ...data, id };
      onCreated(product);
      setSaved(product);
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

        {saved ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-success">
              <Check size={22} />
              <h2 className="text-lg font-black text-slate-900 tracking-tighter">
                Product Added & Selected
              </h2>
            </div>

            <p className="text-xs text-slate-400 font-bold -mt-2">
              {saved.name} is now selected on this order.
            </p>

            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Barcode
              </div>
              <div className="font-mono font-black text-slate-900 text-lg tracking-widest">
                {saved.barcode}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  printBarcodeLabel({
                    name: saved.name,
                    barcode: saved.barcode || "",
                    price: saved.sellingPrice,
                    currency,
                  })
                }
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl font-black shadow-high shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                <Printer size={16} />
                Print Label
              </button>

              <button
                type="button"
                onClick={close}
                className="px-5 rounded-2xl border border-slate-100 font-black text-slate-500 text-xs uppercase tracking-widest"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-black text-slate-900 tracking-tighter mb-1 flex items-center gap-2">
              <Package size={20} className="text-primary" />
              Quick-Add Product
            </h2>
            <p className="text-xs text-slate-400 font-bold mb-6">
              Just enough to continue this order — full setup stays in
              Inventory.
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
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                    Category
                  </label>
                  <input
                    required
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                    Type
                  </label>
                  <select
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold outline-none"
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as "Retail" | "Operational",
                      })
                    }
                  >
                    <option value="Retail">Retail</option>
                    <option value="Operational">Operational</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    value={form.sellingPrice}
                    onChange={(e) =>
                      setForm({ ...form, sellingPrice: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                  Minimum Stock
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  value={form.minimumStock}
                  onChange={(e) =>
                    setForm({ ...form, minimumStock: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                  Barcode (optional — scan or generate)
                </label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <Barcode
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                    />
                    <input
                      className="w-full p-4 pl-11 rounded-2xl border border-slate-100 bg-slate-50 font-mono font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      placeholder="Scan or leave blank"
                      value={form.barcode}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={onBarcodeKeyDown}
                      onChange={(e) =>
                        setForm({ ...form, barcode: e.target.value })
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    disabled={generating}
                    title="Generate a unique barcode"
                    className="shrink-0 px-4 rounded-2xl border border-slate-100 bg-slate-50 font-black text-primary text-xs uppercase tracking-widest disabled:opacity-60 flex items-center gap-1"
                  >
                    <RefreshCw
                      size={14}
                      className={generating ? "animate-spin" : ""}
                    />
                    {generating ? "..." : "Gen"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-300 font-bold ml-3">
                  Left blank, a barcode is generated automatically when
                  you save.
                </p>
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
          </>
        )}
      </div>
    </div>
  );
}
