import { Router } from 'express';
import { getPlans, submitPayment, myPayments, mySubscription } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.get('/plans', protect, getPlans);
router.use(protect, requireBusiness);
router.post('/', submitPayment);
router.get('/mine', myPayments);
router.get('/subscription', mySubscription);
export default router;
