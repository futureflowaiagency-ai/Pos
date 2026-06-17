import { Router } from 'express';
import { getExpenses, createExpense, deleteExpense } from '../controllers/expenseController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.route('/').get(getExpenses).post(createExpense);
router.delete('/:id', deleteExpense);
export default router;
