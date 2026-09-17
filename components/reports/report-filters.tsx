import React from "react";
import { Search } from "lucide-react";
import type { ReportDefinition } from "@/lib/report-catalog";
import type { ReportsData, DatePreset } from "@/lib/use-reports-data";
import { PAYMENT_METHODS } from "@/lib/use-reports-data";

const DATE_PRESETS: DatePreset[] = [
  "Today",
  "Week",
  "Month",
  "Year",
  "All",
  "Custom",
];

export function ReportFilters({
  definition,
  data,
}: {
  definition: ReportDefinition;
  data: ReportsData;
}) {
  const has = (key: string) => definition.filters.includes(key as any);

  const selectClass =
    "px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-semibold text-xs text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-premium p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {DATE_PRESETS.map((value) => (
          <button
            key={value}
            onClick={() => data.applyPreset(value)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              data.preset === value
                ? "bg-primary text-white shadow-glow-primary"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            {value}
          </button>
        ))}

        <input
          type="date"
          value={data.start}
          onChange={(event) => {
            data.applyPreset("Custom");
            data.setStart(event.target.value);
          }}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />

        <span className="self-center text-slate-300 text-xs font-semibold">to</span>

        <input
          type="date"
          value={data.end}
          onChange={(event) => {
            data.applyPreset("Custom");
            data.setEnd(event.target.value);
          }}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      {(has("staff") ||
        has("service") ||
        has("product") ||
        has("customer") ||
        has("paymentMethod") ||
        has("status")) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-2.5">
          {has("staff") && (
            <select
              value={data.staffFilter}
              onChange={(e) => data.setStaffFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Staff</option>

              {data.staffList?.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.title}
                </option>
              ))}
            </select>
          )}

          {has("service") && (
            <select
              value={data.serviceFilter}
              onChange={(e) => data.setServiceFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Services</option>

              {data.services?.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          )}

          {has("product") && (
            <select
              value={data.productFilter}
              onChange={(e) => data.setProductFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Products</option>

              {data.products?.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          )}

          {has("customer") && (
            <select
              value={data.customerFilter}
              onChange={(e) => data.setCustomerFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Customers</option>

              {data.customers?.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          )}

          {has("paymentMethod") && (
            <select
              value={data.paymentMethodFilter}
              onChange={(e) => data.setPaymentMethodFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Payments</option>

              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          )}

          {has("status") && (
            <select
              value={data.statusFilter}
              onChange={(e) => data.setStatusFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">Completed Sales</option>
              <option value="Completed">Completed</option>
              <option value="Voided">Voided</option>
              <option value="Refunded">Refunded</option>
              <option value="Reversed">Reversed</option>
            </select>
          )}
        </div>
      )}

      {(has("search") ||
        has("staff") ||
        has("service") ||
        has("product") ||
        has("customer") ||
        has("paymentMethod") ||
        has("status")) && (
        <div className="flex gap-2.5 mt-2.5">
          {has("search") && (
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />

              <input
                value={data.search}
                onChange={(e) => data.setSearch(e.target.value)}
                placeholder="Search receipt, customer or staff..."
                className="w-full pl-9 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-semibold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          )}

          <button
            onClick={data.clearFilters}
            className="px-4 rounded-lg bg-slate-100 text-slate-500 font-semibold text-xs hover:bg-slate-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
