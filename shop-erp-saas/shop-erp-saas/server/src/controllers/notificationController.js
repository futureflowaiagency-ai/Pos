import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import Notification from '../models/Notification.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find(tenantFilter(req)).sort('-createdAt').limit(50);
  const unread = notifications.filter((n) => !n.isRead).length;
  ok(res, { notifications, unread });
});

export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(tenantFilter(req, { isRead: false }), { isRead: true });
  ok(res, {}, 'Marked all as read');
});
