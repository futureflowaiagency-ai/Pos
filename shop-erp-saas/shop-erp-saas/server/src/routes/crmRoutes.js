import { Router } from 'express';
import * as crm from '../controllers/crmController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();
router.use(protect, requireBusiness, requireModule('crm'));

const mount = (path, c) => {
  router.route(`/${path}`).get(c.list).post(c.create);
  router.route(`/${path}/:id`).put(c.update).delete(c.remove);
};

mount('companies', crm.companies);
mount('contacts', crm.contacts);
mount('leads', crm.leads);
mount('deals', crm.deals);
mount('tasks', crm.tasks);
mount('notes', crm.notes);

export default router;
