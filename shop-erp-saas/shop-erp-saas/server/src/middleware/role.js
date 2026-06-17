import { ApiError } from '../utils/ApiError.js';

// authorize('owner', 'staff') etc.
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new ApiError(403, 'Forbidden: insufficient permissions');
  }
  next();
};

export const superadminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    throw new ApiError(403, 'Forbidden: superadmin only');
  }
  next();
};
