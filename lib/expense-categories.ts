// Shared default expense categories, used by both the Expense Manager
// (app/expenses/page.tsx) and the Expense Limits section of Settings
// (app/settings/page.tsx), so both pages always agree on the list.
// Custom categories added from the Expense Manager page are stored
// separately in db.settings.expenseCategories and merged on top of this
// default list wherever it's used.
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Petty Cash', 'Maintenance', 'Utilities', 'Rent',
  'Salaries', 'Supplies', 'Transport', 'Other'
];
