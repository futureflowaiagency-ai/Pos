import { Router } from 'express';
import { getLogs } from '../controllers/activityLogController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();
// Owner/superadmin always see this (requireModule bypasses for them); a staff
// member only sees it if the owner has explicitly granted the 'activity' module.
router.use(protect, requireBusiness, requireModule('activity'));
router.get('/', getLogs);
export default router;
