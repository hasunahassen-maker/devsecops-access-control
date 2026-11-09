const permissions = new Map([
  ['waiter', ['orders:create', 'orders:read']],
  ['cashier', ['orders:read', 'payments:create']],
  ['manager', ['orders:read', 'reports:read']],
  ['admin', ['users:manage', 'orders:read']],
]);

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.sendStatus(403);
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!permissions.get(req.user.role)?.includes(permission)) return res.sendStatus(403);
    next();
  };
}

function canAccessOrder(user, order) {
  return user.role === 'admin' || Boolean(user.branchId && user.branchId === order.branchId);
}
module.exports = { requireRole, requirePermission, canAccessOrder };
