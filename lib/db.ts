import Dexie, { Table } from 'dexie';
import { getDbName } from '@/lib/app-mode';

export type UserRole =
  | 'Admin'
  | 'Supervisor'
  | 'Cashier';

export type Permission =
  | 'view_dashboard'
  | 'view_users'
  | 'create_users'
  | 'edit_users'
  | 'delete_users'
  | 'manage_permissions'
  | 'view_customers'
  | 'create_customers'
  | 'edit_customers'
  | 'delete_customers'
  | 'view_clinical_records'
  | 'manage_clinical_records'
  | 'view_services'
  | 'manage_services'
  | 'access_pos'
  | 'apply_discounts'
  | 'void_transactions'
  | 'refund_transactions'
  | 'reverse_transactions'
  | 'edit_transactions'
  | 'manage_cash_drawer'
  | 'view_reports'
  | 'manage_settings'
  | 'view_bookings'
  | 'create_bookings'
  | 'edit_bookings'
  | 'manage_booking_status'
  | 'manage_staff'
  | 'manage_commissions'
  | 'manage_expenses'
  | 'manage_inventory'
  | 'manage_suppliers'
  | 'manage_purchase_orders'
  | 'manage_packages'
  | 'manage_memberships'
  | 'manage_vouchers'
  | 'manage_loyalty'
  | 'manage_promotions'
  | 'manage_attendance'
  | 'manage_leave'
  | 'view_audit_logs'
  | 'manage_backups';

export type PaymentMethod =
  | 'Cash'
  | 'M-Pesa'
  | 'Card'
  | 'Bank Transfer'
  | 'Other'
  | 'Voucher';

export type PaymentStatus =
  | 'Unpaid'
  | 'Pending'
  | 'Partially Paid'
  | 'Paid'
  | 'Cancelled';

export type TransactionStatus =
  | 'Completed'
  | 'Voided'
  | 'Refunded'
  | 'Reversed';

export type ModuleName =
  | 'booking'
  | 'customer-record'
  | 'staff'
  | 'commission'
  | 'expense'
  | 'supplier'
  | 'purchase-order'
  | 'package'
  | 'membership'
  | 'voucher'
  | 'loyalty'
  | 'promotion'
  | 'attendance'
  | 'leave'
  | 'notification'
  | 'cash_drawer';

export interface Service {
  id?: number;
  name: string;
  category: string;
  price: number;
  duration?: number;
  isActive: boolean;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id?: number;
  username: string;
  /** @deprecated legacy plain-text password — kept only so old accounts can be migrated on next login. Do not write new plain passwords here. */
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  role: UserRole;
  permissions?: Permission[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  gender: string;
  dob?: string;
  notes: string;
  loyaltyPoints: number;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClinicalRecord {
  id?: number;
  customerId: number;
  date: Date;
  recordType:
    | 'Consultation'
    | 'Treatment'
    | 'Progress Note';
  staffId: number;
  serviceId?: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  id: string;
  type: 'Service' | 'Product';
  serviceId?: number;
  productId?: number;
  name: string;
  price: number;
  quantity: number;
  staffId?: number;
  staffName?: string;
  discount: number;
  total: number;
}

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  cardLast4?: string;
  approvalCode?: string;
  date: Date;
}

export interface Sale {
  id?: number;
  receiptNumber: string;
  isDemo?: boolean;
  customerId: number;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  totalPaid: number;
  balance: number;
  tipAmount?: number;
  status: PaymentStatus;
  transactionStatus: TransactionStatus;
  payments: SalePayment[];
  cashierId: string;
  cashierName: string;
  notes?: string;
  voidReason?: string;
  voidedAt?: Date;
  voidedBy?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  refundedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id?: number;
  userId: string;
  username: string;
  action: string;
  details: string;
  timestamp: Date;
}

export interface InventoryItem {
  id?: number;
  type: 'Retail' | 'Operational';
  name: string;
  category: string;
  sku?: string;
  barcode?: string;
  supplierId?: number;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  expiryDate?: Date;
  isActive: boolean;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryMovement {
  id?: number;
  productId: number;
  type:
    | 'Stock In'
    | 'Sale'
    | 'Consumption'
    | 'Adjustment'
    | 'Return';
  quantity: number;
  beforeQty: number;
  afterQty: number;
  userId: string;
  reason: string;
  date: Date;
}

export interface SystemSettings {
  id?: number;
  salonName: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  currency: string;
  taxRate: number;
  taxEnabled: boolean;
    receiptFooter: string;
  expenseLimits: Record<string, number>;
  /** Custom "Primary Position" options added from the Staff page, on top of the built-in defaults. */
  staffPositions?: string[];
  /** Custom service category options added from the Services page, on top of the built-in defaults. */
  serviceCategories?: string[];
  /** Custom membership plan options added from the Memberships page, on top of the built-in defaults. */
  membershipPlans?: string[];
  /** Custom expense category options added from the Expense Manager page, on top of the built-in defaults. */
  expenseCategories?: string[];
  updatedAt: Date;
}

export interface Booking {
  id?: number;
  isDemo?: boolean;
  customerId: number;
  customerName: string;
  type: 'Walk-in' | 'Appointment';
  status:
    | 'Booked'
    | 'Confirmed'
    | 'Waiting'
    | 'In Progress'
    | 'Completed'
    | 'Cancelled'
    | 'No Show';
  bookingDate: Date;
  startTime: string;
  endTime: string;
  services: {
    serviceId: number;
    name: string;
    price: number;
    staffId?: number;
  }[];
  staffId?: number;
  staffName?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: string;
}

// A sale "parked" mid-checkout so a cashier can serve another customer and
// come back to it later. Stores exactly what the POS cart needs to be
// rebuilt (cart items, chosen customer, in-progress payment lines, and the
// manager-approved discount) so resuming puts the screen back exactly as it
// was left.
export interface HeldSale {
  id?: number;
  holdId: string;
  customerId?: number;
  customerName?: string;
  cart: SaleItem[];
  payments: SalePayment[];
  discount: number;
  tip?: number;
  cashierId: string;
  cashierName: string;
  createdAt: Date;
}

export interface ModuleRecord {
  id?: number;
  module: ModuleName;
  title: string;
  status: string;
  customerId?: number;
  staffId?: number;
  amount?: number;
  quantity?: number;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

// --- Report Center (favorites / recents / saved reports) ---------------
//
// These back the "accounting software" style Report Center: a starred
// shortcut list, an auto-tracked recently-viewed list, and named saved
// views (a report + its filter snapshot) that can optionally carry a
// reminder cadence. There is no background scheduler in this offline
// app, so a reminder never sends anything on its own — it just surfaces
// a "due" badge next time the Report Center is opened, computed from
// `lastRunAt`.

export type ReportReminder =
  | 'None'
  | 'Daily'
  | 'Weekly'
  | 'Monthly';

export interface ReportFilterSnapshot {
  preset: string;
  start: string;
  end: string;
  staffFilter: string;
  serviceFilter: string;
  productFilter: string;
  customerFilter: string;
  paymentMethodFilter: string;
  statusFilter: string;
  search: string;
}

export interface ReportFavorite {
  /** The report id, used directly as the primary key (one row per report). */
  reportId: string;
  createdAt: Date;
}

export interface ReportRecent {
  /** The report id, used directly as the primary key (one row per report). */
  reportId: string;
  viewedAt: Date;
}

export interface SavedReport {
  id?: number;
  reportId: string;
  name: string;
  filters: ReportFilterSnapshot;
  reminder: ReportReminder;
  lastRunAt?: Date;
  createdAt: Date;
}

export class SalonDatabase extends Dexie {
  services!: Table<Service>;
  users!: Table<User>;
  customers!: Table<Customer>;
  clinicalRecords!: Table<ClinicalRecord>;
  sales!: Table<Sale>;
  auditLogs!: Table<AuditLog>;
  inventory!: Table<InventoryItem>;
  inventoryMovements!: Table<InventoryMovement>;
  settings!: Table<SystemSettings>;
  bookings!: Table<Booking>;
  cashDrawers!: Table<any>;
  cashMovements!: Table<any>;
  moduleRecords!: Table<ModuleRecord>;
  heldSales!: Table<HeldSale>;
  reportFavorites!: Table<ReportFavorite>;
  reportRecents!: Table<ReportRecent>;
  savedReports!: Table<SavedReport>;

  constructor() {
    // The database name is resolved once, from whichever environment
    // (Production or Training) is active when this module first loads.
    // See lib/app-mode.ts — switching environments triggers a full app
    // reload so this picks up the other name cleanly.
    super(getDbName());

    this.version(9).stores({
      services:
        '++id, name, category, isActive, createdAt, updatedAt',

      users:
        '++id, username, role, isActive, createdAt, updatedAt',

      customers:
        '++id, name, phone, email, createdAt, updatedAt',

      clinicalRecords:
        '++id, customerId, staffId, date, createdAt, updatedAt',

      sales:
        '++id, receiptNumber, customerId, status, transactionStatus, createdAt, updatedAt',

      auditLogs:
        '++id, userId, action, timestamp',

      inventory:
        '++id, name, type, category, sku, isActive, createdAt, updatedAt',

      inventoryMovements:
        '++id, productId, type, date',

      settings:
        '++id',

      bookings:
        '++id, customerId, status, bookingDate, staffId, createdAt, updatedAt',

      cashDrawers:
        '++id, status, openedAt',

      cashMovements:
        '++id, drawerId, type',

      moduleRecords:
        '++id, module, status, customerId, staffId, createdAt, updatedAt',
    });

    // Version 10 only adds the new heldSales store (for the "Hold / Resume
    // Sale" feature). Every store from version 9 is repeated unchanged below
    // — Dexie requires the full schema on each version bump — so no existing
    // data is touched or migrated.
    this.version(10).stores({
      services:
        '++id, name, category, isActive, createdAt, updatedAt',

      users:
        '++id, username, role, isActive, createdAt, updatedAt',

      customers:
        '++id, name, phone, email, createdAt, updatedAt',

      clinicalRecords:
        '++id, customerId, staffId, date, createdAt, updatedAt',

      sales:
        '++id, receiptNumber, customerId, status, transactionStatus, createdAt, updatedAt',

      auditLogs:
        '++id, userId, action, timestamp',

      inventory:
        '++id, name, type, category, sku, isActive, createdAt, updatedAt',

      inventoryMovements:
        '++id, productId, type, date',

      settings:
        '++id',

      bookings:
        '++id, customerId, status, bookingDate, staffId, createdAt, updatedAt',

      cashDrawers:
        '++id, status, openedAt',

      cashMovements:
        '++id, drawerId, type',

      moduleRecords:
        '++id, module, status, customerId, staffId, createdAt, updatedAt',

      heldSales:
        '++id, holdId, cashierId, createdAt',
    });

    // Version 11 only adds the three Report Center stores (favorites,
    // recently-viewed, and saved/named report views). As with the bump
    // above, every existing store is repeated unchanged — Dexie requires
    // the full schema on each version — so no existing data is touched.
    this.version(11).stores({
      services:
        '++id, name, category, isActive, createdAt, updatedAt',

      users:
        '++id, username, role, isActive, createdAt, updatedAt',

      customers:
        '++id, name, phone, email, createdAt, updatedAt',

      clinicalRecords:
        '++id, customerId, staffId, date, createdAt, updatedAt',

      sales:
        '++id, receiptNumber, customerId, status, transactionStatus, createdAt, updatedAt',

      auditLogs:
        '++id, userId, action, timestamp',

      inventory:
        '++id, name, type, category, sku, isActive, createdAt, updatedAt',

      inventoryMovements:
        '++id, productId, type, date',

      settings:
        '++id',

      bookings:
        '++id, customerId, status, bookingDate, staffId, createdAt, updatedAt',

      cashDrawers:
        '++id, status, openedAt',

      cashMovements:
        '++id, drawerId, type',

      moduleRecords:
        '++id, module, status, customerId, staffId, createdAt, updatedAt',

      heldSales:
        '++id, holdId, cashierId, createdAt',

      reportFavorites: 'reportId, createdAt',

      reportRecents: 'reportId, viewedAt',

      savedReports: '++id, reportId, createdAt',
    });
  }
}

export const db = new SalonDatabase();
