import { Router } from 'express';
import { advancedReport } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.get('/advanced', advancedReport);
export default router;
