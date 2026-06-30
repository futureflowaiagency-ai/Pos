import mongoose from 'mongoose';

// A marketing campaign (SMS or Email) sent by a shop owner to their customers,
// using the owner's own gateway/SMTP credentials (see MarketingSettings).
const campaignSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ['sms', 'email'], required: true },

    subject: { type: String, default: '' },  // email only
    body: { type: String, required: true },   // supports {{name}} placeholder

    // Who to send to.
    audience: { type: String, enum: ['all', 'due', 'custom'], default: 'all' },
    customRecipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],

    status: { type: String, enum: ['draft', 'sending', 'sent', 'failed'], default: 'draft' },
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    failures: [{ recipient: String, error: String }],
    sentAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Campaign', campaignSchema);
