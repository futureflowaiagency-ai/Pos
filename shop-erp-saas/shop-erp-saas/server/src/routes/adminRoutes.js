import { Router } from 'express';
import { adminOverview, listPayments, reviewPayment, listBusinesses, toggleBusinessOwner, createOwner, setBusinessPlan } from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { superadminOnly } from '../middleware/role.js';

const router = Router();
router.use(protect, superadminOnly);
router.get('/overview', adminOverview);
router.get('/payments', listPayments);
router.patch('/payments/:id', reviewPayment);
router.get('/businesses', listBusinesses);
router.post('/owners', createOwner);
router.patch('/businesses/:id/toggle', toggleBusinessOwner);
router.patch('/businesses/:id/plan', setBusinessPlan);
export default router;
