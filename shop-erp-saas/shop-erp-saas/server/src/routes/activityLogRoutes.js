import { Router } from 'express';
import { getLogs } from '../controllers/activityLogController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { authorize } from '../middleware/role.js';

const router = Router();
router.use(protect, requireBusiness, authorize('owner', 'superadmin'));
router.get('/', getLogs);
export default router;
