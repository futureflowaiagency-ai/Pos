import mongoose from 'mongoose';

export const PLANS = {
  monthly: { label: 'Monthly', price: 500, days: 30 },
  half_yearly: { label: 'Half-Yearly', price: 2500, days: 182 },
  yearly: { label: 'Yearly', price: 4500, days: 365 },
};

const subscriptionSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    plan: { type: String, enum: Object.keys(PLANS), required: true },
    amount: { type: Number, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
  },
  { timestamps: true }
);

export default mongoose.model('Subscription', subscriptionSchema);
