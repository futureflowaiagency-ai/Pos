import { Router } from 'express';
import { advancedReport } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();
router.use(protect, requireBusiness, requireModule('finance'));
router.get('/advanced', advancedReport);
export default router;
