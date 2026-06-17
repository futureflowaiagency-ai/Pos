import { Router } from 'express';
import { createSale, getSales, getSale, salesReport } from '../controllers/saleController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.route('/').get(getSales).post(createSale);
router.get('/report', salesReport);
router.get('/:id', getSale);
export default router;
