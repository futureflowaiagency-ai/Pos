import { Router } from 'express';
import { exportEntity, fullBackup, importExportHistory } from '../controllers/exportController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';

const router = Router();
router.use(protect, requireBusiness);
router.get('/backup/full', fullBackup);
router.get('/history/list', importExportHistory);
router.get('/:entity', exportEntity);
export default router;
