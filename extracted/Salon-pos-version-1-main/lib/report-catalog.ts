import type { ElementType } from "react";
import {
  BarChart3,
  CreditCard,
  Package,
  Scissors,
  Users,
  Award,
  CalendarDays,
  Wallet,
  FileBarChart,
} from "lucide-react";

export type ReportId =
  | "overview"
  | "payments"
  | "products"
  | "services"
  | "customers"
  | "staff"
  | "bookings"
  | "cash"
  | "transactions";

export type FilterKey =
  | "dateRange"
  | "staff"
  | "service"
  | "product"
  | "customer"
  | "paymentMethod"
  | "status"
  | "search";

export interface ReportDefinition {
  id: ReportId;
  name: string;
  description: string;
  category: string;
  icon: ElementType;
  /** Which filter controls this report shows, in display order. */
  filters: FilterKey[];
}

export const REPORT_CATEGORY_ORDER = [
  "Sales & Revenue",
  "People",
  "Operations",
  "Transactions",
] as const;

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "overview",
    name: "Sales Overview",
    description:
      "Gross sales, discounts, tax, refunds and voids for the period, plus payment mix and recorded result.",
    category: "Sales & Revenue",
    icon: BarChart3,
    filters: ["dateRange", "status", "search"],
  },
  {
    id: "payments",
    name: "Payment Methods",
    description:
      "How customers paid — cash, M-Pesa, card, bank transfer and more — with each method's share of collections.",
    category: "Sales & Revenue",
    icon: CreditCard,
    filters: ["dateRange", "paymentMethod", "status"],
  },
  {
    id: "products",
    name: "Product Sales",
    description:
      "Units sold and revenue by retail product, plus current stock levels and inventory movement.",
    category: "Sales & Revenue",
    icon: Package,
    filters: ["dateRange", "product", "status"],
  },
  {
    id: "services",
    name: "Service Sales",
    description: "Quantity performed and revenue earned by service.",
    category: "Sales & Revenue",
    icon: Scissors,
    filters: ["dateRange", "service", "status"],
  },
  {
    id: "customers",
    name: "Customer Report",
    description: "Visit counts and total spend by customer.",
    category: "People",
    icon: Users,
    filters: ["dateRange", "customer", "status"],
  },
  {
    id: "staff",
    name: "Staff & Commission",
    description:
      "Sales attributed to each staff member, split by service and product, with commission earned.",
    category: "People",
    icon: Award,
    filters: ["dateRange", "staff", "status"],
  },
  {
    id: "bookings",
    name: "Bookings",
    description: "Appointment volume and a status breakdown for the period.",
    category: "Operations",
    icon: CalendarDays,
    filters: ["dateRange", "staff"],
  },
  {
    id: "cash",
    name: "Cash Reconciliation",
    description:
      "Opening balance, cash sales and drawer movements, with expected cash on hand.",
    category: "Operations",
    icon: Wallet,
    filters: ["dateRange"],
  },
  {
    id: "transactions",
    name: "Transaction Detail",
    description:
      "Every receipt in the period, with customer, staff, totals and balance.",
    category: "Transactions",
    icon: FileBarChart,
    filters: [
      "dateRange",
      "customer",
      "paymentMethod",
      "status",
      "search",
    ],
  },
];

export function getReportDefinition(
  id: string | null | undefined
): ReportDefinition | undefined {
  return REPORT_DEFINITIONS.find((report) => report.id === id);
}

export function reportsByCategory(): {
  category: string;
  reports: ReportDefinition[];
}[] {
  return REPORT_CATEGORY_ORDER.map((category) => ({
    category,
    reports: REPORT_DEFINITIONS.filter(
      (report) => report.category === category
    ),
  }));
}
