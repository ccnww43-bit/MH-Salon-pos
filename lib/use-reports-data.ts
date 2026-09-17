"use client";

import { useMemo, useState } from "react";
import { db, PaymentMethod } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { dateOnly } from "@/lib/report-utils";
import type { ReportFilterSnapshot } from "@/lib/db";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "M-Pesa",
  "Card",
  "Bank Transfer",
  "Other",
  "Customer Credit",
  "Voucher",
];

export type DatePreset = "Today" | "Week" | "Month" | "Year" | "All" | "Custom";

export function useReportsData() {
  const [preset, setPreset] = useState<DatePreset>("All");

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [staffFilter, setStaffFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const sales = useLiveQuery(() => db.sales.toArray(), []);

  const expenses = useLiveQuery(
    () => db.moduleRecords.where("module").equals("expense").toArray(),
    []
  );

  // Staff = the employee directory (db.moduleRecords, module 'staff'),
  // the same source POS checkout, Bookings and Commissions use to record
  // who performed a service. Deliberately NOT db.users (login accounts) —
  // item.staffId / booking.staffId below are staff-directory ids, so
  // filtering against login-account ids would never match anything.
  const staffList = useLiveQuery(
    () =>
      db.moduleRecords
        .where("module")
        .equals("staff")
        .and((s) => s.status === "Active")
        .toArray(),
    []
  );

  const services = useLiveQuery(
    () => db.services.filter((s) => s.isActive).toArray(),
    []
  );

  const products = useLiveQuery(() => db.inventory.toArray(), []);

  const customers = useLiveQuery(() => db.customers.toArray(), []);

  const bookings = useLiveQuery(() => db.bookings.toArray(), []);

  const movements = useLiveQuery(
    () => db.inventoryMovements.toArray(),
    []
  );

  const commissionRules = useLiveQuery(
    () => db.moduleRecords.where("module").equals("commission").toArray(),
    []
  );

  const cashDrawers = useLiveQuery(() => db.cashDrawers.toArray(), []);

  const cashMovements = useLiveQuery(() => db.cashMovements.toArray(), []);

  const settings = useLiveQuery(() => db.settings.toArray(), []);

  const currency = settings?.[0]?.currency || "KSh";

  /**
   * Any of the queries above being `undefined` means Dexie hasn't resolved
   * yet — used to distinguish "still loading" from "genuinely empty" so the
   * UI doesn't flash an empty state on first paint.
   */
  const isLoading =
    sales === undefined ||
    expenses === undefined ||
    staffList === undefined ||
    services === undefined ||
    products === undefined ||
    customers === undefined ||
    bookings === undefined ||
    movements === undefined ||
    commissionRules === undefined ||
    cashDrawers === undefined ||
    cashMovements === undefined ||
    settings === undefined;

  const applyPreset = (next: DatePreset) => {
    setPreset(next);

    const today = new Date();
    const todayStr = dateOnly(today);

    if (next === "Today") {
      setStart(todayStr);
      setEnd(todayStr);
    } else if (next === "Week") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);

      setStart(dateOnly(d));
      setEnd(todayStr);
    } else if (next === "Month") {
      setStart(dateOnly(new Date(today.getFullYear(), today.getMonth(), 1)));
      setEnd(todayStr);
    } else if (next === "Year") {
      setStart(dateOnly(new Date(today.getFullYear(), 0, 1)));
      setEnd(todayStr);
    } else if (next === "All") {
      setStart("");
      setEnd("");
    }
  };

  const dateInRange = (value: Date | string | undefined) => {
    const d = dateOnly(value);

    return (!start || d >= start) && (!end || d <= end);
  };

  /*
   * ALL SALES IN THE SELECTED DATE RANGE.
   *
   * This deliberately includes voided/refunded/reversed transactions so
   * the dashboard can accurately report refunds and voids.
   */
  const allInRange = useMemo(
    () => (sales || []).filter((sale) => dateInRange(sale.createdAt)),
    [sales, start, end]
  );

  /*
   * NORMAL SALES USED FOR REVENUE CALCULATIONS.
   *
   * Existing application logic defines Completed as the normal completed
   * transaction state.
   */
  const filteredSales = useMemo(
    () =>
      allInRange.filter((sale) => {
        if (!statusFilter && sale.transactionStatus !== "Completed") {
          return false;
        }

        if (statusFilter && sale.transactionStatus !== statusFilter) {
          return false;
        }

        if (customerFilter && String(sale.customerId) !== customerFilter) {
          return false;
        }

        if (
          paymentMethodFilter &&
          !sale.payments?.some(
            (payment) => payment.method === paymentMethodFilter
          )
        ) {
          return false;
        }

        if (
          staffFilter &&
          !sale.items?.some((item) => String(item.staffId) === staffFilter)
        ) {
          return false;
        }

        if (
          serviceFilter &&
          !sale.items?.some(
            (item) => String(item.serviceId) === serviceFilter
          )
        ) {
          return false;
        }

        if (
          productFilter &&
          !sale.items?.some(
            (item) => String(item.productId) === productFilter
          )
        ) {
          return false;
        }

        if (search) {
          const searchable = `
            ${sale.receiptNumber}
            ${sale.customerName}
            ${sale.cashierName}
          `.toLowerCase();

          if (!searchable.includes(search.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    [
      allInRange,
      statusFilter,
      customerFilter,
      paymentMethodFilter,
      staffFilter,
      serviceFilter,
      productFilter,
      search,
    ]
  );

  const filteredExpenses = useMemo(
    () =>
      (expenses || []).filter((record) => {
        const rawDate = (record.data && record.data.date) || record.createdAt;

        return dateInRange(rawDate);
      }),
    [expenses, start, end]
  );

  const filteredBookings = useMemo(
    () =>
      (bookings || []).filter((booking) => {
        if (!dateInRange(booking.bookingDate)) {
          return false;
        }

        if (staffFilter && String(booking.staffId) !== staffFilter) {
          return false;
        }

        return true;
      }),
    [bookings, start, end, staffFilter]
  );

  /*
   * CORE SALES ANALYTICS
   */
  const analytics = useMemo(() => {
    const gross = filteredSales.reduce(
      (total, sale) => total + Number(sale.subtotal || 0),
      0
    );

    const discounts = filteredSales.reduce(
      (total, sale) => total + Number(sale.discount || 0),
      0
    );

    const tax = filteredSales.reduce(
      (total, sale) => total + Number(sale.tax || 0),
      0
    );

    const revenue = filteredSales.reduce(
      (total, sale) => total + Number(sale.total || 0),
      0
    );

    const expensesTotal = filteredExpenses.reduce(
      (total, record) => total + Number(record.amount || 0),
      0
    );

    const paid = filteredSales.reduce(
      (total, sale) => total + Number(sale.totalPaid || 0),
      0
    );

    const balance = filteredSales.reduce(
      (total, sale) => total + Number(sale.balance || 0),
      0
    );

    const refunds = allInRange
      .filter((sale) => sale.transactionStatus === "Refunded")
      .reduce(
        (total, sale) =>
          total + Number(sale.refundAmount || sale.total || 0),
        0
      );

    const voids = allInRange
      .filter((sale) => sale.transactionStatus === "Voided")
      .reduce((total, sale) => total + Number(sale.total || 0), 0);

    return {
      gross,
      discounts,
      tax,
      revenue,
      expensesTotal,
      paid,
      balance,
      refunds,
      voids,
      transactions: filteredSales.length,
      average:
        filteredSales.length > 0 ? revenue / filteredSales.length : 0,

      /*
       * This is deliberately NOT called "Profit". The existing schema
       * does not provide enough evidence for a complete accounting
       * profit figure.
       */
      estimatedResult: revenue - expensesTotal,
    };
  }, [filteredSales, filteredExpenses, allInRange]);

  /*
   * PAYMENT REPORT
   */
  const paymentTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const sale of filteredSales) {
      for (const payment of sale.payments || []) {
        totals.set(
          payment.method,
          (totals.get(payment.method) || 0) + Number(payment.amount || 0)
        );
      }
    }

    return PAYMENT_METHODS.map((method) => ({
      method,
      total: totals.get(method) || 0,
    })).filter((row) => row.total > 0);
  }, [filteredSales]);

  /*
   * PRODUCT SALES REPORT
   */
  const productReport = useMemo(() => {
    const map = new Map
      number,
      { id: number; name: string; qty: number; sales: number }
    >();

    for (const sale of filteredSales) {
      for (const item of sale.items || []) {
        if (item.type !== "Product" || !item.productId) {
          continue;
        }

        const old = map.get(item.productId) || {
          id: item.productId,
          name: item.name,
          qty: 0,
          sales: 0,
        };

        old.qty += Number(item.quantity || 0);
        old.sales += Number(item.total || 0);

        map.set(item.productId, old);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [filteredSales]);

  /*
   * SERVICE REPORT
   */
  const serviceReport = useMemo(() => {
    const map = new Map
      number,
      { id: number; name: string; qty: number; revenue: number }
    >();

    for (const sale of filteredSales) {
      for (const item of sale.items || []) {
        if (item.type !== "Service" || !item.serviceId) {
          continue;
        }

        const old = map.get(item.serviceId) || {
          id: item.serviceId,
          name: item.name,
          qty: 0,
          revenue: 0,
        };

        old.qty += Number(item.quantity || 0);
        old.revenue += Number(item.total || 0);

        map.set(item.serviceId, old);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  /*
   * CUSTOMER REPORT
   */
  const customerReport = useMemo(() => {
    const map = new Map
      number,
      { id: number; name: string; visits: number; spend: number }
    >();

    for (const sale of filteredSales) {
      const old = map.get(sale.customerId) || {
        id: sale.customerId,
        name: sale.customerName,
        visits: 0,
        spend: 0,
      };

      old.visits += 1;
      old.spend += Number(sale.total || 0);

      map.set(sale.customerId, old);
    }

    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [filteredSales]);

  /*
   * STAFF + COMMISSION REPORT
   *
   * Uses the existing sale item staffId and existing commission module
   * records.
   */
  const staffReport = useMemo(() => {
    const map = new Map
      number,
      {
        id: number;
        name: string;
        sales: number;
        services: number;
        products: number;
        commission: number;
        itemCount: number;
      }
    >();

    const activeRules = (commissionRules || []).filter(
      (rule) => rule.status === "Active"
    );

    for (const sale of filteredSales) {
      // Spread the sale's cart-level discount (manual + membership,
      // sale.discount) proportionally across items — same fix as
      // Commissions — so a whole-cart discount actually reduces the sales
      // figure attributed to staff instead of using the pre-discount price.
      const saleDiscount = Number(sale.discount) || 0;
      const saleSubtotal = Number(sale.subtotal) || 0;

      for (const item of sale.items || []) {
        if (!item.staffId) continue;

        const itemTotal = Number(item.total || 0);
        const itemShareOfDiscount = saleSubtotal > 0 ? (itemTotal / saleSubtotal) * saleDiscount : 0;
        const effectiveTotal = Math.max(0, itemTotal - itemShareOfDiscount);

        const old = map.get(item.staffId) || {
          id: item.staffId,
          name: item.staffName || String(item.staffId),
          sales: 0,
          services: 0,
          products: 0,
          commission: 0,
          itemCount: 0,
        };

        old.sales += effectiveTotal;
        old.itemCount += Number(item.quantity || 1);

        if (item.type === "Service") {
          old.services += effectiveTotal;
        } else {
          old.products += effectiveTotal;
        }

        map.set(item.staffId, old);
      }
    }

    return Array.from(map.values())
      .map((staff) => {
        const rule =
          activeRules.find((r) => r.staffId === staff.id) ||
          activeRules.find((r) => !r.staffId);

        const rate = Number(rule?.data?.rate) || 0;

        return {
          ...staff,
          commission:
            rule?.data?.type === "Fixed Amount"
              ? rate * staff.itemCount
              : (staff.sales * rate) / 100,
        };
      })
      .sort((a, b) => b.sales - a.sales);
  }, [filteredSales, commissionRules]);

  /*
   * BOOKING REPORT
   */
  const bookingReport = useMemo(() => {
    const map = new Map<string, number>();

    for (const booking of filteredBookings) {
      map.set(booking.status, (map.get(booking.status) || 0) + 1);
    }

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBookings]);

  /*
   * INVENTORY MOVEMENT SUMMARY
   */
  const movementReport = useMemo(() => {
    const map = new Map<string, number>();

    for (const movement of movements || []) {
      if (!dateInRange(movement.date)) {
        continue;
      }

      map.set(
        movement.type,
        (map.get(movement.type) || 0) + Number(movement.quantity || 0)
      );
    }

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [movements, start, end]);

  /*
   * CASH RECONCILIATION
   *
   * Uses existing cash drawer and cash movement tables. Because those
   * tables use `any` in the current database schema, unknown fields are
   * read defensively.
   */
  const cashReport = useMemo(() => {
    const relevantMovements = (cashMovements || []).filter((movement: any) =>
      dateInRange(movement.date || movement.createdAt)
    );

    const cashSales =
      paymentTotals.find((row) => row.method === "Cash")?.total || 0;

    const movementTotal = relevantMovements.reduce(
      (sum: number, movement: any) => {
        const amount = Number(movement.amount) || 0;
        const type = String(movement.type || "").toLowerCase();

        const isOut =
          type.includes("out") ||
          type.includes("withdraw") ||
          type.includes("expense");

        return sum + (isOut ? -amount : amount);
      },
      0
    );

    const opening = (cashDrawers || [])
      .filter((drawer: any) => {
        if (!drawer.openedAt) {
          return false;
        }

        if (!start) return true;

        return dateOnly(drawer.openedAt) <= start;
      })
      .reduce(
        (sum: number, drawer: any) =>
          sum + (Number(drawer.openingBalance) || 0),
        0
      );

    return {
      cashSales,
      movementTotal,
      opening,
      // NOTE: cashSales is NOT added here — every completed cash sale
      // already posts an "IN" cash movement at checkout (and voids/refunds
      // post a matching "OUT"), so movementTotal already reflects it.
      // Adding cashSales on top double-counted every cash sale.
      expected: opening + movementTotal,
      relevantMovements,
    };
  }, [cashMovements, cashDrawers, paymentTotals, start, end]);

  const clearFilters = () => {
    setStaffFilter("");
    setServiceFilter("");
    setProductFilter("");
    setCustomerFilter("");
    setPaymentMethodFilter("");
    setStatusFilter("");
    setSearch("");
  };

  /** A snapshot of every filter, for saving/restoring a named report view. */
  const filterSnapshot = (): ReportFilterSnapshot => ({
    preset,
    start,
    end,
    staffFilter,
    serviceFilter,
    productFilter,
    customerFilter,
    paymentMethodFilter,
    statusFilter,
    search,
  });

  const restoreFilters = (snapshot: ReportFilterSnapshot) => {
    setPreset(snapshot.preset as DatePreset);
    setStart(snapshot.start);
    setEnd(snapshot.end);
    setStaffFilter(snapshot.staffFilter);
    setServiceFilter(snapshot.serviceFilter);
    setProductFilter(snapshot.productFilter);
    setCustomerFilter(snapshot.customerFilter);
    setPaymentMethodFilter(snapshot.paymentMethodFilter);
    setStatusFilter(snapshot.statusFilter);
    setSearch(snapshot.search);
  };

  return {
    currency,
    isLoading,

    // filter state
    preset,
    start,
    end,
    staffFilter,
    serviceFilter,
    productFilter,
    customerFilter,
    paymentMethodFilter,
    statusFilter,
    search,
    setStart,
    setEnd,
    setStaffFilter,
    setServiceFilter,
    setProductFilter,
    setCustomerFilter,
    setPaymentMethodFilter,
    setStatusFilter,
    setSearch,
    applyPreset,
    clearFilters,
    filterSnapshot,
    restoreFilters,

    // lookup lists (for filter dropdowns)
    staffList,
    services,
    products,
    customers,

    // filtered datasets
    filteredSales,
    filteredBookings,

    // computed reports
    analytics,
    paymentTotals,
    productReport,
    serviceReport,
    customerReport,
    staffReport,
    bookingReport,
    movementReport,
    cashReport,
  };
}

export type ReportsData = ReturnType<typeof useReportsData>;
