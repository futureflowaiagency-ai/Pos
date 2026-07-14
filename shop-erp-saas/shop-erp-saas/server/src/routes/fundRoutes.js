import { Router } from 'express';
import { getFunds, createFund, deleteFund } from '../controllers/fundController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.route('/').get(getFunds).post(createFund);
router.delete('/:id', deleteFund);
export default router;
