import { Router } from 'express';
import {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
  supplierLedger, recordPurchase, paySupplier,
} from '../controllers/supplierController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);

router.route('/').get(getSuppliers).post(createSupplier);
router.route('/:id').get(supplierLedger).put(updateSupplier).delete(deleteSupplier);
router.post('/:id/purchase', recordPurchase);
router.post('/:id/pay', paySupplier);

export default router;
