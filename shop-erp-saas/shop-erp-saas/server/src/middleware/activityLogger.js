import ActivityLog from '../models/ActivityLog.js';

// Fire-and-forget logger usable inside controllers.
export const logActivity = async (req, { action, entity, entityId, meta }) => {
  try {
    await ActivityLog.create({
      business: req.businessId || null,
      user: req.user?._id,
      action,
      entity,
      entityId,
      meta,
      ip: req.ip,
    });
  } catch (e) {
    // never block the main request on logging failure
    console.error('Activity log failed:', e.message);
  }
};
