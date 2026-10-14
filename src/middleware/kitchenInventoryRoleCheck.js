const ALLOWED_ROLES = new Set(['Owner', 'Administrator']);

const requireKitchenInventoryRole = (req, res, next) => {
  const role = req.user?.role || req.body?.requestor?.role;
  if (!ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ message: 'You are not authorized to access this resource' });
  }
  return next();
};

module.exports = requireKitchenInventoryRole;
