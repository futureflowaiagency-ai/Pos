import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { logActivity } from '../middleware/activityLogger.js';
import Business from '../models/Business.js';

// @route GET /api/business
export const getMyBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.businessId);
  ok(res, { business });
});

// @route PUT /api/business
export const updateBusiness = asyncHandler(async (req, res) => {
  const allowed = ['name', 'type', 'address', 'phone', 'email', 'logoUrl', 'currency', 'footerWebsite', 'settings'];
  const update = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const business = await Business.findByIdAndUpdate(req.businessId, update, { new: true });
  await logActivity(req, { action: 'UPDATE_BUSINESS', entity: 'Business', entityId: business._id });
  ok(res, { business }, 'Business updated');
});
