import { Router } from 'express';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, customerHistory, collectDue } from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.route('/').get(getCustomers).post(createCustomer);
router.route('/:id').put(updateCustomer).delete(deleteCustomer);
router.get('/:id/history', customerHistory);
router.post('/:id/collect-due', collectDue);
export default router;
