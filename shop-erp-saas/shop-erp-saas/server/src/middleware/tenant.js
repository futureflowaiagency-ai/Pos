import { ApiError } from '../utils/ApiError.js';

// Ensures the request belongs to a business workspace.
// Adds req.businessId guaranteed (used by all tenant resources).
export const requireBusiness = (req, res, next) => {
  if (req.user.role === 'superadmin') {
    // superadmin may pass ?businessId= for inspection
    req.businessId = req.query.businessId || req.businessId;
  }
  if (!req.businessId) throw new ApiError(400, 'No business workspace associated');
  next();
};

// Helper to always inject the tenant filter into queries.
export const tenantFilter = (req, extra = {}) => ({ business: req.businessId, ...extra });
