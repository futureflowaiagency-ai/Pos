import { Router } from 'express';
import {
  getSettings, updateSettings, testSms, testEmail, aiGenerate,
  audiencePreview, listCampaigns, createCampaign, deleteCampaign, sendCampaign,
} from '../controllers/marketingController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { authorize } from '../middleware/role.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();
router.use(protect, requireBusiness, requireModule('marketing'));

// Credentials & integrations (owner-only — they hold the keys/costs).
router.route('/settings').get(getSettings).put(authorize('owner', 'superadmin'), updateSettings);
router.post('/settings/test-sms', authorize('owner', 'superadmin'), testSms);
router.post('/settings/test-email', authorize('owner', 'superadmin'), testEmail);

// AI copy drafting.
router.post('/ai/generate', aiGenerate);

// Audience + campaigns.
router.get('/audience', audiencePreview);
router.route('/campaigns').get(listCampaigns).post(createCampaign);
router.delete('/campaigns/:id', deleteCampaign);
router.post('/campaigns/:id/send', sendCampaign);

export default router;
