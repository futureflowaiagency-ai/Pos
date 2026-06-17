import { Router } from 'express';
import { getMyBusiness, updateBusiness } from '../controllers/businessController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { authorize } from '../middleware/role.js';

const router = Router();
router.use(protect, requireBusiness);
router.get('/', getMyBusiness);
router.put('/', authorize('owner', 'superadmin'), updateBusiness);
export default router;
