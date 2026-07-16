import { ApiError } from '../utils/ApiError.js';

// Gate a route to one or more modules. Only applies to 'staff' users — owner and
// superadmin always have full access regardless of their `permissions` list, since
// this feature exists to let an owner limit what specific employees can see, not
// to limit the owner themselves.
export const requireModule = (...modules) => (req, res, next) => {
  if (req.user.role !== 'staff') return next();
  const allowed = req.user.permissions || [];
  if (!modules.some((m) => allowed.includes(m))) {
    throw new ApiError(403, 'You do not have access to this section. Ask the shop owner to grant it.');
  }
  next();
};
