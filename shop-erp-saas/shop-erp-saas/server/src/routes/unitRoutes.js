import { Router } from 'express';
import { getUnits, addUnits, deleteUnit, lookupUnit, warrantyCheck } from '../controllers/phoneUnitController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);

router.get('/lookup', lookupUnit);     // POS: resolve an in-stock device by IMEI
router.get('/warranty', warrantyCheck); // Warranty check portal
router.route('/').get(getUnits).post(addUnits);
router.delete('/:id', deleteUnit);

export default router;
