import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import Payment from '../models/Payment.js';
import Subscription, { PLANS } from '../models/Subscription.js';
import Business from '../models/Business.js';

// @route GET /api/payments/plans
export const getPlans = asyncHandler(async (req, res) => ok(res, { plans: PLANS }));

// @route POST /api/payments  (owner submits TRX id)
export const submitPayment = asyncHandler(async (req, res) => {
  const { plan, method, senderNumber, trxId } = req.body;
  if (!PLANS[plan]) throw new ApiError(400, 'Invalid plan');
  if (!trxId) throw new ApiError(400, 'Transaction ID required');

  const payment = await Payment.create({
    business: req.businessId,
    submittedBy: req.user._id,
    plan,
    amount: PLANS[plan].price,
    method,
    senderNumber,
    trxId,
  });
  await logActivity(req, { action: 'SUBMIT_PAYMENT', entity: 'Payment', entityId: payment._id, meta: { plan, trxId } });
  created(res, { payment }, 'Payment submitted, pending approval');
});

// @route GET /api/payments/mine
export const myPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find(tenantFilter(req)).sort('-createdAt');
  ok(res, { payments });
});

// @route GET /api/payments/subscription
export const mySubscription = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.businessId);
  const latest = await Subscription.findOne(tenantFilter(req)).sort('-endDate');
  ok(res, {
    status: business.subscriptionStatus,
    expiry: business.subscriptionExpiry,
    subscription: latest,
  });
});
