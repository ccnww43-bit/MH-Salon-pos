import { UserRole, Permission } from './db';

export const ALL_PERMISSIONS: Permission[] = [
  'view_dashboard', 'view_users', 'create_users', 'edit_users', 'delete_users', 'manage_permissions',
  'view_customers', 'create_customers', 'edit_customers', 'delete_customers',
  'view_clinical_records', 'manage_clinical_records', 'view_services', 'manage_services',
  'access_pos', 'apply_discounts', 'void_transactions', 'refund_transactions', 'reverse_transactions',
  'edit_transactions',
  'manage_cash_drawer', 'view_reports', 'manage_settings', 'view_bookings', 'create_bookings',
  'edit_bookings', 'manage_booking_status', 'manage_staff', 'manage_commissions', 'manage_expenses',
  'manage_inventory', 'manage_suppliers', 'manage_purchase_orders', 'manage_packages',
  'manage_memberships', 'manage_vouchers', 'manage_loyalty', 'manage_promotions',
  'manage_attendance', 'manage_leave', 'view_audit_logs', 'manage_backups'
];

export const PERMISSION_GROUPS = [
  { name: 'Analytics', permissions: ['view_dashboard', 'view_reports'] },
  { name: 'Security', permissions: ['view_users', 'create_users', 'edit_users', 'delete_users', 'manage_permissions', 'view_audit_logs', 'manage_backups'] },
  { name: 'Client Relations', permissions: ['view_customers', 'create_customers', 'edit_customers', 'delete_customers', 'view_clinical_records', 'manage_clinical_records'] },
  { name: 'Checkout & Money', permissions: ['access_pos', 'apply_discounts', 'void_transactions', 'refund_transactions', 'reverse_transactions', 'edit_transactions', 'manage_cash_drawer', 'manage_expenses'] },
  { name: 'Business Flow', permissions: ['view_bookings', 'create_bookings', 'edit_bookings', 'manage_booking_status', 'view_services', 'manage_services', 'manage_inventory', 'manage_suppliers', 'manage_purchase_orders'] },
  { name: 'Incentives', permissions: ['manage_packages', 'manage_memberships', 'manage_vouchers', 'manage_loyalty', 'manage_promotions'] },
  { name: 'Workforce', permissions: ['manage_staff', 'manage_commissions', 'manage_attendance', 'manage_leave'] },
  { name: 'System', permissions: ['manage_settings'] }
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_dashboard: 'Access Dashboard', view_users: 'View Staff List', create_users: 'Create Access',
  edit_users: 'Edit Access', delete_users: 'Revoke Access', manage_permissions: 'Define Roles',
  view_customers: 'View Client Base', create_customers: 'Register Client', edit_customers: 'Edit Client',
  delete_customers: 'Purge Client', view_clinical_records: 'View Treatments',
  manage_clinical_records: 'Write Treatment Log', view_services: 'View Menu',
  manage_services: 'Update Price List', access_pos: 'Operate POS', apply_discounts: 'Authorize Discounts',
  void_transactions: 'Void Invoices', refund_transactions: 'Process Refunds',
  reverse_transactions: 'Reverse Payments', edit_transactions: 'Edit Invoice Line Items',
  manage_cash_drawer: 'Reconcile Drawer',
  view_reports: 'Full Auditing', manage_settings: 'Global Config', view_bookings: 'View Schedule',
  create_bookings: 'New Reservation', edit_bookings: 'Modify Reservation',
  manage_booking_status: 'Check-in/Checkout', manage_staff: 'Manage HR',
  manage_commissions: 'Configure Payouts', manage_expenses: 'Expense Control',
  manage_inventory: 'Stock Control', manage_suppliers: 'Vendor List',
  manage_purchase_orders: 'Procurement', manage_packages: 'Manage Bundles',
  manage_memberships: 'VIP Status', manage_vouchers: 'Issue Credits',
  manage_loyalty: 'Loyalty Rules', manage_promotions: 'Marketing Campaigns',
  manage_attendance: 'Duty Scans', manage_leave: 'Leave Approval',
  view_audit_logs: 'System Transparency', manage_backups: 'Database Recovery'
};

const rolePermissions: Record<UserRole, Permission[]> = {
  Admin: [...ALL_PERMISSIONS],
  Supervisor: [
    'view_dashboard', 'view_customers', 'create_customers', 'edit_customers',
    'view_clinical_records', 'manage_clinical_records', 'view_services',
    'access_pos', 'apply_discounts', 'view_bookings', 'create_bookings', 'edit_bookings',
    'manage_booking_status', 'manage_inventory', 'manage_attendance', 'view_reports'
  ],
  Cashier: [
    'view_customers', 'create_customers', 'access_pos', 'view_bookings', 'create_bookings'
  ]
};

export function hasPermission(
  role: string | null | undefined,
  permission: Permission | string,
  customPermissions?: Permission[]
): boolean {
  if (!role) return false;
  if (role === 'Admin') return true;
  const currentRole = role as UserRole;
  const basePermissions = rolePermissions[currentRole] || [];
  if (customPermissions && customPermissions.length > 0) return customPermissions.includes(permission as Permission);
  return basePermissions.includes(permission as Permission);
}

export function getPermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}
