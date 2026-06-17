import { Router } from 'express';
import { dashboardSummary, revenueChart } from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.get('/summary', dashboardSummary);
router.get('/revenue-chart', revenueChart);
export default router;
