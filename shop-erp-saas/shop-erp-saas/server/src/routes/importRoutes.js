import { Router } from 'express';
import { downloadTemplate, validateImport, commitImport, restoreBackup } from '../controllers/importController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { authorize } from '../middleware/role.js';

const router = Router();
router.use(protect, requireBusiness);
const ownerOnly = authorize('owner', 'superadmin');

router.get('/:entity/template', downloadTemplate);
router.post('/backup/restore', ownerOnly, restoreBackup);
router.post('/:entity/validate', ownerOnly, validateImport);
router.post('/:entity/commit', ownerOnly, commitImport);
export default router;
