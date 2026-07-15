import { Router } from 'express';
import { getTransfers, createTransfer, deleteTransfer } from '../controllers/transferController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.route('/').get(getTransfers).post(createTransfer);
router.delete('/:id', deleteTransfer);
export default router;
