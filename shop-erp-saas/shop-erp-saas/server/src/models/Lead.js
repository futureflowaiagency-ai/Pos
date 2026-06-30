import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    source: { type: String, trim: true, default: '' }, // Facebook, Walk-in, Referral...
    status: { type: String, enum: ['new', 'contacted', 'qualified', 'won', 'lost'], default: 'new' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Lead', leadSchema);
