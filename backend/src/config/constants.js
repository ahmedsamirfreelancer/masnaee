export const ROLES = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  PRODUCTION_SUPERVISOR: 'production_supervisor',
  WORKER: 'worker',
  SALES_REP: 'sales_rep',
};

export const PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.ACCOUNTANT]: [
    'sales.view', 'sales.create', 'sales.edit',
    'purchases.view', 'purchases.create', 'purchases.edit',
    'customers.view', 'customers.create', 'customers.edit',
    'suppliers.view', 'suppliers.create', 'suppliers.edit',
    'accounting.*',
    'expenses.*',
    'payments.*',
    'reports.*',
    'hr.salaries.view', 'hr.salaries.create',
    'assets.view', 'assets.create', 'assets.edit',
    'inventory.view',
    'products.view',
  ],
  [ROLES.PRODUCTION_SUPERVISOR]: [
    'production.*',
    'inventory.*',
    'quality.*',
    'products.view',
    'materials.view', 'materials.edit',
    'recipes.view', 'recipes.create', 'recipes.edit',
    'reports.production',
  ],
  [ROLES.WORKER]: [
    'production.view', 'production.log',
    'inventory.view',
    'quality.create',
    'attendance.self',
  ],
  [ROLES.SALES_REP]: [
    'sales.view', 'sales.create', 'sales.edit',
    'customers.view', 'customers.create', 'customers.edit',
    'products.view',
    'inventory.view',
    'reports.sales',
  ],
};

export const ORDER_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
};

export const PRODUCTION_STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export function hasPermission(userRole, requiredPermission) {
  const perms = PERMISSIONS[userRole];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  const [module, action] = requiredPermission.split('.');
  return perms.includes(requiredPermission) ||
    perms.includes(`${module}.*`);
}
