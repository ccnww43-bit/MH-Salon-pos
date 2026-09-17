"use client";

import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import PermissionGuard from "@/components/permissionguard";
import { logAction } from "@/lib/logger";
import { Plus, X } from "lucide-react";

interface Movement {
  id: number;
  productId: number;
  productName: string;
  type: "Stock In" | "Sale" | "Consumption" | "Adjustment" | "Return";
  quantity: number;
  reason: string;
  date: string;
  user: string;
}

const STOCK_IN_TYPES = new Set(["Stock In", "Return"]);
const STOCK_OUT_TYPES = new Set(["Sale", "Consumption"]);

export default function InventoryMovementsPage() {
  // Live-queried straight from Dexie, so this page re-renders the instant
  // anything writes to db.inventoryMovements — including a POS sale, which
  // logs a "Sale" movement for every product sold at checkout.
  const movementRecords = useLiveQuery(
    () => db.inventoryMovements.toArray(),
    []
  );

  const products = useLiveQuery(() => db.inventory.toArray(), []);

  const loading = movementRecords === undefined || products === undefined;

  // New Movement modal — the only way, until now, to correct stock after a
  // stocktake, spoilage, or theft (Adjustment), or to decrement operational
  // stock consumed while performing a service (Consumption). Follows the
  // same before/after-stock + inventoryMovements-record pattern already
  // used by POS sales, Purchase Order receipts, and Void/Refund.
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    productId: "",
    type: "Adjustment" as "Adjustment" | "Consumption",
    direction: "Decrease" as "Increase" | "Decrease",
    quantity: "",
    reason: "",
  });

  const activeProducts = useMemo(
    () => (products || []).filter((p: any) => p.isActive !== false),
    [products]
  );

  const openModal = () => {
    setForm({
      productId: "",
      type: "Adjustment",
      direction: "Decrease",
      quantity: "",
      reason: "",
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError("");
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const productId = Number(form.productId);
    const quantity = Number(form.quantity);
    const reason = form.reason.trim();

    if (!productId) {
      setFormError("Select a product.");
      return;
    }

    if (!quantity || quantity <= 0) {
      setFormError("Enter a quantity greater than zero.");
      return;
    }

    if (!reason) {
      setFormError("A reason is required — e.g. the stocktake, spoilage, theft, or service that caused this change.");
      return;
    }

    setSaving(true);

    try {
      const product = await db.inventory.get(productId);
      if (!product) {
        setFormError("That product could not be found.");
        setSaving(false);
        return;
      }

      // Consumption always decreases stock (a product used up while
      // performing a service). Adjustment can go either way, chosen above.
      const decreasing = form.type === "Consumption" || form.direction === "Decrease";

      const before = product.currentStock;
      const after = decreasing ? before - quantity : before + quantity;

      if (after < 0) {
        setFormError(`This would take stock negative (currently ${before} in stock).`);
        setSaving(false);
        return;
      }

      const now = new Date();

      await db.inventory.update(productId, {
        currentStock: after,
        updatedAt: now,
      });

      await db.inventoryMovements.add({
        productId,
        type: form.type,
        quantity,
        beforeQty: before,
        afterQty: after,
        userId: localStorage.getItem("username") || "Admin",
        reason,
        date: now,
      });

      await logAction(
        "Inventory",
        `${form.type}: ${decreasing ? "-" : "+"}${quantity} ${product.name} (${before} \u2192 ${after}) — ${reason}`
      );

      setShowModal(false);
    } catch (error) {
      console.error("Failed to record movement:", error);
      setFormError("Could not record this movement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const movements: Movement[] = useMemo(() => {
    const productNameById = new Map<number, string>(
      (products || []).map((p: any) => [p.id as number, p.name])
    );

    return (movementRecords || [])
      .map((movement: any) => ({
        id: movement.id,
        productId: movement.productId,
        productName:
          productNameById.get(movement.productId) || "Unknown Product",
        type: movement.type || "Adjustment",
        quantity: Number(movement.quantity || 0),
        reason: movement.reason || "",
        date: movement.date || movement.createdAt || "",
        user: movement.userId || "System",
      }))
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  }, [movementRecords, products]);

  return (
    <PermissionGuard permission="manage_inventory">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Inventory Movements</h1>
            <p className="text-gray-500 text-sm">
              Track stock received, used, and adjusted.
            </p>
          </div>

          <button
            onClick={openModal}
            className="shrink-0 inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold hover:bg-blue-700"
          >
            <Plus size={18} /> New Movement
          </button>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Product</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-right p-4">Quantity</th>
                  <th className="text-left p-4">Reason</th>
                  <th className="text-left p-4">User</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      No inventory movements found.
                    </td>
                  </tr>
                ) : (
                  movements.map((movement) => (
                    <tr key={movement.id} className="border-b last:border-0">
                      <td className="p-4">
                        {movement.date
                          ? new Date(movement.date).toLocaleString()
                          : "-"}
                      </td>

                      <td className="p-4 font-medium">
                        {movement.productName}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            STOCK_IN_TYPES.has(movement.type)
                              ? "bg-green-100 text-green-700"
                              : STOCK_OUT_TYPES.has(movement.type)
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {movement.type}
                        </span>
                      </td>

                      <td className="p-4 text-right font-semibold">
                        {movement.quantity}
                      </td>

                      <td className="p-4">{movement.reason || "-"}</td>

                      <td className="p-4">{movement.user}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
              >
                <X size={22} />
              </button>

              <h2 className="text-xl font-bold mb-4">New Movement</h2>

              <form onSubmit={handleSubmitMovement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Product *
                  </label>
                  <select
                    required
                    value={form.productId}
                    onChange={(e) =>
                      setForm({ ...form, productId: e.target.value })
                    }
                    className="border rounded-lg px-3 py-2 w-full"
                  >
                    <option value="">Select a product...</option>
                    {activeProducts.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (in stock: {p.currentStock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Type
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          type: e.target.value as "Adjustment" | "Consumption",
                          // Consumption always decreases stock, so force the
                          // direction to match if the user switches types.
                          direction:
                            e.target.value === "Consumption"
                              ? "Decrease"
                              : form.direction,
                        })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    >
                      <option value="Adjustment">
                        Adjustment (stocktake, theft, correction)
                      </option>
                      <option value="Consumption">
                        Consumption (used performing a service)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Direction
                    </label>
                    {form.type === "Consumption" ? (
                      <div className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-gray-500">
                        Decrease
                      </div>
                    ) : (
                      <select
                        value={form.direction}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            direction: e.target.value as "Increase" | "Decrease",
                          })
                        }
                        className="border rounded-lg px-3 py-2 w-full"
                      >
                        <option value="Decrease">Decrease stock</option>
                        <option value="Increase">Increase stock</option>
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Reason *
                  </label>
                  <textarea
                    required
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                    placeholder="e.g. Monthly stocktake shortfall, spoiled stock, used during service..."
                    className="border rounded-lg px-3 py-2 w-full min-h-[80px]"
                  />
                </div>

                {formError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 border rounded-lg px-4 py-2 font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Record Movement"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
