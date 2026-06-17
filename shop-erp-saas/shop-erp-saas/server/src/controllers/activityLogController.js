import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import ActivityLog from '../models/ActivityLog.js';

export const getLogs = asyncHandler(async (req, res) => {
  const logs = await ActivityLog.find(tenantFilter(req))
    .populate('user', 'name email')
    .sort('-createdAt')
    .limit(200);
  ok(res, { logs });
});
