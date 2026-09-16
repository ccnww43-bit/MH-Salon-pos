"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import PermissionGuard from "@/components/permissionguard";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { logAction } from "@/lib/logger";
import { X, Edit3, Trash2, Power } from "lucide-react";

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  supplier: string;
  supplierContact: string;
  type: "Retail" | "Operational";
  costPrice: number;
  sellingPrice: number;
  quantityReceived: number;
  quantityUsed: number;
  currentStock: number;
  minimumStock: number;
  dateReceived: string;
  expiryDate: string;
  isActive: boolean;
}

const emptyForm = {
  name: "",
  type: "Retail" as "Retail" | "Operational",
  category: "",
  sku: "",
  supplierId: "",
  costPrice: "",
  sellingPrice: "",
  currentStock: "",
  minimumStock: "",
  expiryDate: "",
};

const PAGE_SIZE = 10;

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Tracks which product is being edited. null means the modal (when open)
  // is in "add new product" mode; a number means it's editing that product.
  const [editingId, setEditingId] = useState<number | null>(null);

  // Pagination — mirrors the pattern used on the Customers page so this
  // list doesn't render every row in the catalog at once.
  const [page, setPage] = useState(1);

  // Note: this whole page is already wrapped in <PermissionGuard
  // permission="manage_inventory">, so anyone who can see this page
  // already has permission to manage inventory — no extra check needed
  // here for the Add Product button.

  // Live-queried straight from Dexie, so this page re-renders the instant
  // any other part of the app (a POS sale, a stock adjustment, a purchase
  // order) writes to db.inventory or db.moduleRecords — no manual reload
  // or page re-navigation needed.
  const supplierRecords = useLiveQuery(
    () => db.moduleRecords.where("module").equals("supplier").toArray(),
    []
  );

  const suppliers = useMemo(
    () =>
      (supplierRecords || []).map((r) => ({
        id: r.id as number,
        title: r.title,
      })),
    [supplierRecords]
  );

  const supplierNameById = (supplierId?: number) => {
    if (!supplierId) return "";
    return suppliers.find((s) => s.id === supplierId)?.title || "";
  };

  const rawInventory = useLiveQuery(() => db.inventory.toArray(), []);

  const loading = rawInventory === undefined;

  const items: InventoryItem[] = useMemo(
    () =>
      (rawInventory || []).map((item: any) => ({
        id: item.id,
        name: item.name || item.productName || "",
        category: item.category || "",
        supplier: item.supplier || supplierNameById(item.supplierId) || "",
        supplierContact: item.supplierContact || "",
        type: item.type || "Retail",
        costPrice: Number(item.costPrice || 0),
        sellingPrice: Number(item.sellingPrice || 0),
        quantityReceived: Number(item.quantityReceived || 0),
        quantityUsed: Number(item.quantityUsed || 0),
        currentStock: Number(
          item.currentStock ??
            Number(item.quantityReceived || 0) -
              Number(item.quantityUsed || 0)
        ),
        minimumStock: Number(item.minimumStock || 0),
        dateReceived: item.dateReceived || "",
        expiryDate: item.expiryDate || "",
        isActive: item.isActive !== false,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawInventory, suppliers]
  );

  // Whenever the search term or type filter changes, jump back to page 1
  // so the user isn't stranded on a now out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setShowAddModal(true);
  };

  const openEditModal = async (item: InventoryItem) => {
    setFormError("");

    try {
      const record: any = await db.inventory.get(item.id);
      if (!record) return;

      setForm({
        name: record.name || "",
        type: (record.type as "Retail" | "Operational") || "Retail",
        category: record.category || "",
        sku: record.sku || "",
        supplierId: record.supplierId ? String(record.supplierId) : "",
        costPrice:
          record.costPrice != null ? String(record.costPrice) : "",
        sellingPrice:
          record.sellingPrice != null ? String(record.sellingPrice) : "",
        currentStock:
          record.currentStock != null ? String(record.currentStock) : "",
        minimumStock:
          record.minimumStock != null ? String(record.minimumStock) : "",
        expiryDate: record.expiryDate
          ? new Date(record.expiryDate).toISOString().slice(0, 10)
          : "",
      });

      setEditingId(item.id);
      setShowAddModal(true);
    } catch (error) {
      console.error("Failed to load product for editing:", error);
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setFormError("");
    setEditingId(null);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const name = form.name.trim();
    if (!name) {
      setFormError("Product name is required.");
      return;
    }

    const costPrice = Math.max(0, Number(form.costPrice) || 0);
    const sellingPrice = Math.max(0, Number(form.sellingPrice) || 0);
    const minimumStock = Number(form.minimumStock) || 0;

    if (minimumStock < 0) {
      setFormError("Stock quantities cannot be negative.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        // Editing an existing product updates its details only. Current
        // stock is intentionally left untouched here — stock levels are
        // governed by Inventory Movements (Stock In, Sale, Consumption,
        // Adjustment, Return) so the ledger stays reconcilable.
        await db.inventory.update(editingId, {
          type: form.type,
          name,
          category: form.category.trim(),
          sku: form.sku.trim() || undefined,
          supplierId: form.supplierId ? Number(form.supplierId) : undefined,
          costPrice,
          sellingPrice,
          minimumStock,
          expiryDate: form.expiryDate ? new Date(form.expiryDate) : undefined,
          updatedAt: new Date(),
        });

        await logAction("Inventory", `Updated product: ${name}`);
      } else {
        const initialStock = Number(form.currentStock) || 0;

        if (initialStock < 0) {
          setFormError("Stock quantities cannot be negative.");
          setSaving(false);
          return;
        }

        const now = new Date();

        const newId = await db.inventory.add({
          type: form.type,
          name,
          category: form.category.trim(),
          sku: form.sku.trim() || undefined,
          supplierId: form.supplierId ? Number(form.supplierId) : undefined,
          costPrice,
          sellingPrice,
          currentStock: initialStock,
          minimumStock,
          expiryDate: form.expiryDate ? new Date(form.expiryDate) : undefined,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        // Record the opening stock as a real inventory movement, the same
        // way stock received via Purchase Orders is recorded, so the
        // Inventory Movements ledger stays accurate for this product.
        if (initialStock > 0) {
          await db.inventoryMovements.add({
            productId: newId as number,
            type: "Stock In",
            quantity: initialStock,
            beforeQty: 0,
            afterQty: initialStock,
            userId: localStorage.getItem("username") || "Admin",
            reason: "New Product — Opening Stock",
            date: now,
          });
        }

        await logAction(
          "Inventory",
          `Created new product: ${name} (opening stock: ${initialStock})`
        );
      }

      setShowAddModal(false);
      setForm(emptyForm);
      setEditingId(null);
      // No manual reload needed — the live query above picks up the
      // db.inventory write automatically.
    } catch (error) {
      console.error("Failed to save product:", error);
      setFormError("Could not save this product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (item: InventoryItem) => {
    // A product with any movement history (stock received, sold, adjusted,
    // returned) is referenced elsewhere by ID — Inventory Movements and
    // Transactions void/refund both look products up live. Deleting it would
    // make old movements show "Unknown Product" and would make a future
    // void/refund on a sale of this product silently fail to restore stock.
    // Mark it Discontinued instead so history stays intact and it drops out
    // of the POS catalog (POS only shows isActive items).
    const movementCount = await db.inventoryMovements
      .where("productId")
      .equals(item.id)
      .count();

    if (movementCount > 0) {
      alert(
        `"${item.name}" has ${movementCount} recorded stock movement${movementCount === 1 ? '' : 's'} (received, sold, adjusted, or returned), so it can't be deleted without breaking that history. Use the power icon to mark it Discontinued instead — it will disappear from POS but its history stays intact.`
      );
      return;
    }

    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

    try {
      await db.inventory.delete(item.id);
      await logAction("Inventory", `Deleted product: ${item.name}`);
      // No manual reload needed — the live query above picks up the delete.
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  };

  const toggleActive = async (item: InventoryItem) => {
    await db.inventory.update(item.id, {
      isActive: !item.isActive,
      updatedAt: new Date(),
    });
    await logAction(
      "Inventory",
      `${item.isActive ? "Discontinued" : "Reactivated"} product: ${item.name}`
    );
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.supplier.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "All" || item.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [items, search, typeFilter]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const lowStockCount = items.filter(
    (item) => item.currentStock <= item.minimumStock
  ).length;

  return (
    <PermissionGuard permission="manage_inventory">
      <Navbar />
      <div className="page-shell space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-title">Inventory</h1>
            <p className="page-subtitle">
              Manage retail and operational salon products.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold">
              Low Stock: {lowStockCount}
            </div>

            <button
              onClick={openAddModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + Add Product
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inventory..."
              className="border rounded-lg px-3 py-2 flex-1"
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="All">All Types</option>
              <option value="Retail">Retail</option>
              <option value="Operational">Operational</option>
            </select>
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4">Product</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Category</th>
                  <th className="text-left p-4">Supplier</th>
                  <th className="text-right p-4">Cost</th>
                  <th className="text-right p-4">Selling</th>
                  <th className="text-right p-4">Received</th>
                  <th className="text-right p-4">Used</th>
                  <th className="text-right p-4">Stock</th>
                  <th className="text-right p-4">Minimum</th>
                  <th className="text-left p-4">Expiry</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-4 text-center text-gray-500">
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const lowStock =
                      item.currentStock <= item.minimumStock;

                    return (
                      <tr
                        key={item.id}
                        className="border-b last:border-0"
                      >
                        <td className="p-4 font-medium">
                          {item.name}
                          {!item.isActive && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              Discontinued
                            </span>
                          )}
                        </td>

                        <td className="p-4">{item.type}</td>

                        <td className="p-4">{item.category || "-"}</td>

                        <td className="p-4">{item.supplier || "-"}</td>

                        <td className="p-4 text-right">
                          {item.costPrice.toFixed(2)}
                        </td>

                        <td className="p-4 text-right">
                          {item.sellingPrice.toFixed(2)}
                        </td>

                        <td className="p-4 text-right">
                          {item.quantityReceived}
                        </td>

                        <td className="p-4 text-right">
                          {item.quantityUsed}
                        </td>

                        <td
                          className={`p-4 text-right font-bold ${
                            lowStock ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {item.currentStock}
                        </td>

                        <td className="p-4 text-right">
                          {item.minimumStock}
                        </td>

                        <td className="p-4">
                          {item.expiryDate
                            ? new Date(
                                item.expiryDate
                              ).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleActive(item)}
                              className={`p-2 rounded-lg transition-colors ${item.isActive ? "text-gray-400 hover:bg-gray-100" : "text-green-600 hover:bg-green-50"}`}
                              title={item.isActive ? "Discontinue product" : "Reactivate product"}
                            >
                              <Power size={16} />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit product"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(item)}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          totalItems={filteredItems.length}
          itemsPerPage={PAGE_SIZE}
          currentPage={page}
          onPageChange={setPage}
        />

        {showAddModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={closeAddModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
              >
                <X size={22} />
              </button>

              <h2 className="text-xl font-bold mb-4">
                {editingId ? "Edit Product" : "Add New Product"}
              </h2>

              <form onSubmit={handleSubmitProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="border rounded-lg px-3 py-2 w-full"
                  />
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
                          type: e.target.value as "Retail" | "Operational",
                        })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    >
                      <option value="Retail">Retail</option>
                      <option value="Operational">Operational</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      SKU (optional)
                    </label>
                    <input
                      type="text"
                      value={form.sku}
                      onChange={(e) =>
                        setForm({ ...form, sku: e.target.value })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Supplier (optional)
                    </label>
                    <select
                      value={form.supplierId}
                      onChange={(e) =>
                        setForm({ ...form, supplierId: e.target.value })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    >
                      <option value="">None</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Cost Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costPrice}
                      onChange={(e) =>
                        setForm({ ...form, costPrice: e.target.value })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Selling Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.sellingPrice}
                      onChange={(e) =>
                        setForm({ ...form, sellingPrice: e.target.value })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {editingId ? "Current Stock" : "Opening Stock"}
                    </label>
                    {editingId ? (
                      <div className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-gray-500">
                        {form.currentStock || "0"}{" "}
                        <span className="text-xs">
                          (adjust via Inventory Movements)
                        </span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={form.currentStock}
                        onChange={(e) =>
                          setForm({ ...form, currentStock: e.target.value })
                        }
                        className="border rounded-lg px-3 py-2 w-full"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Minimum Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.minimumStock}
                      onChange={(e) =>
                        setForm({ ...form, minimumStock: e.target.value })
                      }
                      className="border rounded-lg px-3 py-2 w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Expiry Date (optional)
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) =>
                      setForm({ ...form, expiryDate: e.target.value })
                    }
                    className="border rounded-lg px-3 py-2 w-full"
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
                    onClick={closeAddModal}
                    className="flex-1 border rounded-lg px-4 py-2 font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                      ? "Save Changes"
                      : "Save Product"}
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
