import mongoose from 'mongoose';

export const SERVICE_STATUSES = ['pending', 'repairing', 'completed', 'delivered'];

// A repair / servicing job sheet for a customer's device.
const serviceJobSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    jobNo: { type: String, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    deviceModel: { type: String, default: '' },
    imei: { type: String, default: '' },
    problem: { type: String, default: '' },
    budget: { type: Number, default: 0 }, // customer's expected budget
    technician: { type: String, default: '' }, // assigned technician (name / emp id)
    status: { type: String, enum: SERVICE_STATUSES, default: 'pending', index: true },
    serviceFee: { type: Number, default: 0 },
    partsCost: { type: Number, default: 0 },
    total: { type: Number, default: 0 }, // serviceFee + partsCost
    paid: { type: Number, default: 0 },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now } }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

serviceJobSchema.index({ business: 1, createdAt: -1 });

export default mongoose.model('ServiceJob', serviceJobSchema);
