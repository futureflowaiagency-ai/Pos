import mongoose from 'mongoose';

export const PLANS = {
  monthly: { label: 'Monthly', price: 500, days: 30 },
  half_yearly: { label: 'Half-Yearly', price: 2500, days: 182 },
  yearly: { label: 'Yearly', price: 4500, days: 365 },
};

// Valid plan keys for payments/subscriptions: default tiers + the per-shop custom plan.
export const PLAN_KEYS = [...Object.keys(PLANS), 'custom'];

// Returns the plans a given business should see. When the super admin has enabled a
// custom price for the shop, that single plan replaces the default tiers; otherwise the
// default PLANS are returned.
export function resolvePlans(business) {
  const cp = business?.customPlan;
  if (cp?.enabled) {
    return {
      custom: {
        label: cp.label || 'Custom Plan',
        price: cp.price || 0,
        days: cp.days || 30,
      },
    };
  }
  return PLANS;
}

const subscriptionSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    plan: { type: String, enum: PLAN_KEYS, required: true },
    amount: { type: Number, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
  },
  { timestamps: true }
);

export default mongoose.model('Subscription', subscriptionSchema);
