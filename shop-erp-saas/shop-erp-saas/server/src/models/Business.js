import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 'general' | 'pharmacy' | 'mobile' -> controls print format & feature modules
    type: { type: String, enum: ['general', 'pharmacy', 'mobile'], default: 'general' },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, default: '' },
    logoUrl: { type: String, default: '' },
    currency: { type: String, default: 'BDT' },
    footerWebsite: { type: String, default: 'https://futureflow.ai' },
    settings: {
      lowStockThreshold: { type: Number, default: 5 },
      printMode: { type: String, enum: ['a4', 'thermal'], default: 'a4' },
    },
    // subscription snapshot for quick access checks
    subscriptionStatus: { type: String, enum: ['trial', 'active', 'expired'], default: 'trial' },
    subscriptionExpiry: { type: Date, default: () => Date.now() + 14 * 24 * 60 * 60 * 1000 },
  },
  { timestamps: true }
);

export default mongoose.model('Business', businessSchema);
