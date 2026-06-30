import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import { encryptSecret, decryptSecret } from '../utils/secretCrypto.js';
import MarketingSettings from '../models/MarketingSettings.js';
import Campaign from '../models/Campaign.js';
import Customer from '../models/Customer.js';
import Business from '../models/Business.js';
import { sendSms } from '../services/smsService.js';
import { buildTransport, verifyEmail, sendEmail } from '../services/emailService.js';
import { generateCopy } from '../services/aiService.js';

// ---------- helpers ----------

const getOrCreateSettings = async (businessId) => {
  let s = await MarketingSettings.findOne({ business: businessId });
  if (!s) s = await MarketingSettings.create({ business: businessId });
  return s;
};

// Client-safe view — never leak stored secrets; expose only "is it set?".
const toClient = (s) => ({
  sms: {
    enabled: s.sms.enabled,
    provider: s.sms.provider,
    apiUrl: s.sms.apiUrl,
    method: s.sms.method,
    senderId: s.sms.senderId,
    paramApiKey: s.sms.paramApiKey,
    paramTo: s.sms.paramTo,
    paramMessage: s.sms.paramMessage,
    paramSender: s.sms.paramSender,
    twilioAccountSid: s.sms.twilioAccountSid,
    twilioFrom: s.sms.twilioFrom,
    apiKeySet: !!s.sms.apiKey,
    twilioAuthTokenSet: !!s.sms.twilioAuthToken,
  },
  email: {
    enabled: s.email.enabled,
    host: s.email.host,
    port: s.email.port,
    secure: s.email.secure,
    user: s.email.user,
    fromName: s.email.fromName,
    fromEmail: s.email.fromEmail,
    passSet: !!s.email.pass,
  },
  ai: {
    enabled: s.ai.enabled,
    provider: s.ai.provider,
    model: s.ai.model,
    apiKeySet: !!s.ai.apiKey,
  },
});

// Decrypt secret fields in place for actual use by the services.
const decryptSettings = (s) => ({
  sms: { ...s.sms.toObject(), apiKey: decryptSecret(s.sms.apiKey), twilioAuthToken: decryptSecret(s.sms.twilioAuthToken) },
  email: { ...s.email.toObject(), pass: decryptSecret(s.email.pass) },
  ai: { ...s.ai.toObject(), apiKey: decryptSecret(s.ai.apiKey) },
});

// Apply a non-secret field from body if present.
const setIf = (target, src, key) => { if (src && src[key] !== undefined) target[key] = src[key]; };
// Apply a secret field: encrypt only when a fresh non-empty value is supplied.
const setSecret = (target, src, key) => { if (src && src[key]) target[key] = encryptSecret(src[key]); };

// ---------- settings ----------

export const getSettings = asyncHandler(async (req, res) => {
  const s = await getOrCreateSettings(req.businessId);
  ok(res, { settings: toClient(s) });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const s = await getOrCreateSettings(req.businessId);
  const { sms, email, ai } = req.body;

  if (sms) {
    ['enabled', 'provider', 'apiUrl', 'method', 'senderId', 'paramApiKey', 'paramTo', 'paramMessage', 'paramSender', 'twilioAccountSid', 'twilioFrom']
      .forEach((k) => setIf(s.sms, sms, k));
    setSecret(s.sms, sms, 'apiKey');
    setSecret(s.sms, sms, 'twilioAuthToken');
  }
  if (email) {
    ['enabled', 'host', 'port', 'secure', 'user', 'fromName', 'fromEmail'].forEach((k) => setIf(s.email, email, k));
    setSecret(s.email, email, 'pass');
  }
  if (ai) {
    ['enabled', 'provider', 'model'].forEach((k) => setIf(s.ai, ai, k));
    setSecret(s.ai, ai, 'apiKey');
  }

  await s.save();
  await logActivity(req, { action: 'UPDATE_MARKETING_SETTINGS', entity: 'MarketingSettings', entityId: s._id });
  ok(res, { settings: toClient(s) }, 'Marketing settings saved');
});

// ---------- test sends ----------

export const testSms = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) throw new ApiError(400, 'Provide a test phone number');
  const cfg = decryptSettings(await getOrCreateSettings(req.businessId));
  await sendSms(cfg.sms, to, 'Test message from your Shop ERP marketing setup.');
  ok(res, {}, 'Test SMS sent');
});

export const testEmail = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) throw new ApiError(400, 'Provide a test email address');
  const cfg = decryptSettings(await getOrCreateSettings(req.businessId));
  await verifyEmail(cfg.email);
  const transport = buildTransport(cfg.email);
  await sendEmail(transport, cfg.email, to, 'Shop ERP test email', 'Your SMTP marketing setup works. 🎉');
  ok(res, {}, 'Test email sent');
});

// ---------- AI copy ----------

export const aiGenerate = asyncHandler(async (req, res) => {
  const { channel = 'sms', instructions, tone } = req.body;
  if (!instructions) throw new ApiError(400, 'Describe what the campaign is about');
  const cfg = decryptSettings(await getOrCreateSettings(req.businessId));
  if (!cfg.ai.apiKey) throw new ApiError(400, 'Add your AI API key in Marketing settings first');
  const business = await Business.findById(req.businessId);
  const text = await generateCopy(cfg.ai, { channel, instructions, tone, businessName: business?.name });
  ok(res, { text });
});

// ---------- audience ----------

const resolveRecipients = async (req, channel, audience, customRecipients) => {
  const q = tenantFilter(req, { isActive: true });
  if (audience === 'due') q.totalDue = { $gt: 0 };
  if (audience === 'custom') q._id = { $in: customRecipients || [] };
  // Only customers reachable on this channel.
  if (channel === 'sms') q.phone = { $nin: ['', null] };
  else q.email = { $nin: ['', null] };
  return Customer.find(q).select('name phone email');
};

export const audiencePreview = asyncHandler(async (req, res) => {
  const { channel = 'sms', audience = 'all' } = req.query;
  const recipients = await resolveRecipients(req, channel, audience, []);
  ok(res, { count: recipients.length });
});

// ---------- campaigns ----------

export const listCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await Campaign.find(tenantFilter(req)).sort('-createdAt');
  ok(res, { campaigns });
});

export const createCampaign = asyncHandler(async (req, res) => {
  const { name, channel, subject, body, audience, customRecipients } = req.body;
  if (!name || !channel || !body) throw new ApiError(400, 'Name, channel and message are required');
  const campaign = await Campaign.create({
    business: req.businessId,
    createdBy: req.user._id,
    name, channel, subject, body,
    audience: audience || 'all',
    customRecipients: audience === 'custom' ? (customRecipients || []) : [],
  });
  await logActivity(req, { action: 'CREATE_CAMPAIGN', entity: 'Campaign', entityId: campaign._id });
  created(res, { campaign });
});

export const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOneAndDelete(tenantFilter(req, { _id: req.params.id }));
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  ok(res, {}, 'Campaign deleted');
});

const render = (template, customer) => template.replace(/\{\{\s*name\s*\}\}/g, customer.name || 'there');

export const sendCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  if (campaign.status === 'sending') throw new ApiError(400, 'Campaign is already sending');

  const cfg = decryptSettings(await getOrCreateSettings(req.businessId));
  if (campaign.channel === 'sms' && !cfg.sms.enabled) throw new ApiError(400, 'Enable & configure SMS in Marketing settings first');
  if (campaign.channel === 'email' && !cfg.email.enabled) throw new ApiError(400, 'Enable & configure Email/SMTP in Marketing settings first');

  const recipients = await resolveRecipients(req, campaign.channel, campaign.audience, campaign.customRecipients);
  if (!recipients.length) throw new ApiError(400, 'No reachable customers for this audience');

  campaign.status = 'sending';
  campaign.stats = { total: recipients.length, sent: 0, failed: 0 };
  campaign.failures = [];
  await campaign.save();

  // Reuse one SMTP connection for the whole email batch.
  const transport = campaign.channel === 'email' ? buildTransport(cfg.email) : null;

  for (const c of recipients) {
    const text = render(campaign.body, c);
    try {
      if (campaign.channel === 'sms') {
        await sendSms(cfg.sms, c.phone, text);
      } else {
        await sendEmail(transport, cfg.email, c.email, render(campaign.subject, c), text);
      }
      campaign.stats.sent += 1;
    } catch (e) {
      campaign.stats.failed += 1;
      campaign.failures.push({ recipient: c.phone || c.email, error: e.message });
    }
  }
  if (transport) transport.close();

  campaign.status = campaign.stats.failed === campaign.stats.total ? 'failed' : 'sent';
  campaign.sentAt = new Date();
  await campaign.save();
  await logActivity(req, { action: 'SEND_CAMPAIGN', entity: 'Campaign', entityId: campaign._id, meta: campaign.stats });
  ok(res, { campaign }, `Sent ${campaign.stats.sent}/${campaign.stats.total}`);
});
