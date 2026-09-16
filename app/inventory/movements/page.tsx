"use client";

import React, { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import PermissionGuard from "@/components/permissionguard";

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
        <div>
          <h1 className="text-2xl font-bold">Inventory Movements</h1>
          <p className="text-gray-500 text-sm">
            Track stock received, used, and adjusted.
          </p>
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
      </div>
    </PermissionGuard>
  );
}
