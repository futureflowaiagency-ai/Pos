import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    title: { type: String, required: true, trim: true },
    value: { type: Number, default: 0 },
    // pipeline stage
    stage: { type: String, enum: ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'], default: 'new' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    expectedCloseDate: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Deal', dealSchema);
