"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Percent,
  Receipt,
  Undo2,
  Ban,
  Wallet,
  TrendingUp,
  Hash,
  Package,
  Users,
  Award,
  CalendarDays,
  Banknote,
} from "lucide-react";
import type { ReportId } from "@/lib/report-catalog";
import type { ReportsData } from "@/lib/use-reports-data";
import type { Sale } from "@/lib/db";
import { money, dateOnly } from "@/lib/report-utils";
import { Card, ReportTable, Empty } from "./report-ui";

// The "Staff" column on the Transaction Detail report must show the
// employee(s) who actually performed the service(s) on a sale (from
// sale.items[].staffName) — NOT sale.cashierName, which is the login
// account (User) that processed checkout. Users and Staff are two
// separate things in this system: Users are who can operate the POS,
// Staff are the employees who get credited/commissioned for the work.
// A sale can have more than one specialist across its line items, so
// every distinct one is listed.
function staffNamesForSale(sale: Sale): string {
  const names = Array.from(
    new Set(
      (sale.items || [])
        .map((item) => item.staffName)
        .filter((name): name is string => !!name)
    )
  );
  return names.length ? names.join(", ") : "Unassigned";
}

export function ReportBody({
  reportId,
  data,
}: {
  reportId: ReportId;
  data: ReportsData;
}) {
  const currency = data.currency;
  const router = useRouter();

  // Opens the matching invoice on the Transactions (Financials) page so an
  // admin reviewing this report can jump straight to it — e.g. to correct a
  // wrong specialist on a line item after checkout.
  const openTransaction = (receiptNumber: string) => {
    router.push(`/transactions?receipt=${encodeURIComponent(receiptNumber)}`);
  };

  if (reportId === "overview") {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
          <Card
            title="Gross Sales"
            value={money(currency, data.analytics.gross)}
            icon={DollarSign}
          />
          <Card
            title="Discounts"
            value={money(currency, data.analytics.discounts)}
            icon={Percent}
            muted
          />
          <Card
            title="Tax"
            value={money(currency, data.analytics.tax)}
            icon={Receipt}
            muted
          />
          <Card
            title="Refunds"
            value={money(currency, data.analytics.refunds)}
            icon={Undo2}
            muted
          />
          <Card
            title="Voids"
            value={money(currency, data.analytics.voids)}
            icon={Ban}
            muted
          />
          <Card
            title="Net Revenue"
            value={money(currency, data.analytics.revenue)}
            icon={TrendingUp}
          />
          <Card
            title="Transactions"
            value={String(data.analytics.transactions)}
            icon={Hash}
          />
          <Card
            title="Average Sale"
            value={money(currency, data.analytics.average)}
            icon={DollarSign}
          />
          <Card
            title="Estimated Result"
            value={money(currency, data.analytics.estimatedResult)}
            icon={Wallet}
          />
        </div>

        <ReportTable
          title="Payment Mix"
          headers={["Payment Method", "Amount"]}
          rows={data.paymentTotals.map((row) => [
            row.method,
            money(currency, row.total),
          ])}
        />
      </div>
    );
  }

  if (reportId === "payments") {
    const grandTotal = data.paymentTotals.reduce(
      (sum, row) => sum + row.total,
      0
    );

    return (
      <ReportTable
        title="Payment Methods"
        headers={["Payment Method", "Amount", "Share"]}
        rows={data.paymentTotals.map((row) => [
          row.method,
          money(currency, row.total),
          grandTotal > 0
            ? `${((row.total / grandTotal) * 100).toFixed(1)}%`
            : "0%",
        ])}
      />
    );
  }

  if (reportId === "products") {
    return (
      <div className="space-y-8">
        <ReportTable
          title="Product Sales"
          headers={["Product", "Units Sold", "Revenue"]}
          rows={data.productReport.map((row) => [
            row.name,
            row.qty,
            money(currency, row.sales),
          ])}
        />

        <ReportTable
          title="Stock Levels"
          headers={["Product", "Category", "Current Stock", "Minimum Stock"]}
          rows={(data.products || []).map((item) => [
            item.name,
            item.category,
            item.currentStock,
            item.minimumStock,
          ])}
        />

        <ReportTable
          title="Inventory Movement"
          headers={["Movement Type", "Quantity"]}
          rows={data.movementReport.map(([type, qty]) => [type, qty])}
        />
      </div>
    );
  }

  if (reportId === "services") {
    return (
      <ReportTable
        title="Service Sales"
        headers={["Service", "Quantity", "Revenue"]}
        rows={data.serviceReport.map((row) => [
          row.name,
          row.qty,
          money(currency, row.revenue),
        ])}
      />
    );
  }

  if (reportId === "customers") {
    return (
      <ReportTable
        title="Customer Report"
        headers={["Customer", "Visits", "Total Spend"]}
        rows={data.customerReport.map((row) => [
          row.name,
          row.visits,
          money(currency, row.spend),
        ])}
      />
    );
  }

  if (reportId === "staff") {
    return (
      <ReportTable
        title="Staff & Commission"
        headers={[
          "Staff",
          "Items Sold",
          "Service Revenue",
          "Product Revenue",
          "Total Sales",
          "Commission",
        ]}
        rows={data.staffReport.map((row) => [
          row.name,
          row.itemCount,
          money(currency, row.services),
          money(currency, row.products),
          money(currency, row.sales),
          money(currency, row.commission),
        ])}
      />
    );
  }

  if (reportId === "bookings") {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <Card
            title="Total Bookings"
            value={String(data.filteredBookings.length)}
            icon={CalendarDays}
          />
        </div>

        <ReportTable
          title="Bookings by Status"
          headers={["Status", "Count"]}
          rows={data.bookingReport.map(([status, count]) => [status, count])}
        />
      </div>
    );
  }

  if (reportId === "cash") {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card
            title="Opening Balance"
            value={money(currency, data.cashReport.opening)}
            icon={Wallet}
          />
          <Card
            title="Cash Sales"
            value={money(currency, data.cashReport.cashSales)}
            icon={Banknote}
          />
          <Card
            title="Drawer Movements"
            value={money(currency, data.cashReport.movementTotal)}
            icon={TrendingUp}
            muted
          />
          <Card
            title="Expected Cash"
            value={money(currency, data.cashReport.expected)}
            icon={DollarSign}
          />
        </div>

        <ReportTable
          title="Cash Movements"
          headers={["Date", "Type", "Amount"]}
          rows={data.cashReport.relevantMovements.map((movement: any) => [
            dateOnly(movement.date || movement.createdAt),
            movement.type || "",
            money(currency, Number(movement.amount) || 0),
          ])}
        />
      </div>
    );
  }

  if (reportId === "transactions") {
    return (
      <ReportTable
        title="Transaction Detail"
        headers={[
          "Receipt",
          "Date",
          "Customer",
          "Staff",
          "Total",
          "Paid",
          "Balance",
          "Status",
        ]}
        rows={data.filteredSales.map((sale) => [
          sale.receiptNumber,
          dateOnly(sale.createdAt),
          sale.customerName,
          staffNamesForSale(sale),
          money(currency, sale.total),
          money(currency, sale.totalPaid),
          money(currency, sale.balance),
          sale.transactionStatus,
        ])}
        onRowClick={(index) =>
          openTransaction(data.filteredSales[index].receiptNumber)
        }
      />
    );
  }

  return <Empty />;
}

export function buildReportCsv(
  reportId: ReportId,
  data: ReportsData
): { headers: string[]; rows: (string | number)[][] } {
  const currency = data.currency;

  if (reportId === "overview") {
    return {
      headers: ["Metric", "Value"],
      rows: [
        ["Gross Sales", money(currency, data.analytics.gross)],
        ["Discounts", money(currency, data.analytics.discounts)],
        ["Tax", money(currency, data.analytics.tax)],
        ["Refunds", money(currency, data.analytics.refunds)],
        ["Voids", money(currency, data.analytics.voids)],
        ["Net Revenue", money(currency, data.analytics.revenue)],
        ["Transactions", data.analytics.transactions],
        ["Average Sale", money(currency, data.analytics.average)],
        [
          "Estimated Result",
          money(currency, data.analytics.estimatedResult),
        ],
      ],
    };
  }

  if (reportId === "payments") {
    const grandTotal = data.paymentTotals.reduce(
      (sum, row) => sum + row.total,
      0
    );

    return {
      headers: ["Payment Method", "Amount", "Share"],
      rows: data.paymentTotals.map((row) => [
        row.method,
        money(currency, row.total),
        grandTotal > 0
          ? `${((row.total / grandTotal) * 100).toFixed(1)}%`
          : "0%",
      ]),
    };
  }

  if (reportId === "products") {
    return {
      headers: ["Product", "Units Sold", "Revenue"],
      rows: data.productReport.map((row) => [
        row.name,
        row.qty,
        money(currency, row.sales),
      ]),
    };
  }

  if (reportId === "services") {
    return {
      headers: ["Service", "Quantity", "Revenue"],
      rows: data.serviceReport.map((row) => [
        row.name,
        row.qty,
        money(currency, row.revenue),
      ]),
    };
  }

  if (reportId === "customers") {
    return {
      headers: ["Customer", "Visits", "Total Spend"],
      rows: data.customerReport.map((row) => [
        row.name,
        row.visits,
        money(currency, row.spend),
      ]),
    };
  }

  if (reportId === "staff") {
    return {
      headers: [
        "Staff",
        "Items Sold",
        "Service Revenue",
        "Product Revenue",
        "Total Sales",
        "Commission",
      ],
      rows: data.staffReport.map((row) => [
        row.name,
        row.itemCount,
        money(currency, row.services),
        money(currency, row.products),
        money(currency, row.sales),
        money(currency, row.commission),
      ]),
    };
  }

  if (reportId === "bookings") {
    return {
      headers: ["Status", "Count"],
      rows: data.bookingReport.map(([status, count]) => [status, count]),
    };
  }

  if (reportId === "cash") {
    return {
      headers: ["Date", "Type", "Amount"],
      rows: data.cashReport.relevantMovements.map((movement: any) => [
        dateOnly(movement.date || movement.createdAt),
        movement.type || "",
        money(currency, Number(movement.amount) || 0),
      ]),
    };
  }

  if (reportId === "transactions") {
    return {
      headers: [
        "Receipt",
        "Date",
        "Customer",
        "Staff",
        "Total",
        "Paid",
        "Balance",
        "Status",
      ],
      rows: data.filteredSales.map((sale) => [
        sale.receiptNumber,
        dateOnly(sale.createdAt),
        sale.customerName,
        staffNamesForSale(sale),
        money(currency, sale.total),
        money(currency, sale.totalPaid),
        money(currency, sale.balance),
        sale.transactionStatus,
      ]),
    };
  }

  return { headers: [], rows: [] };
}
