import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. CREATE_PRODUCT
    entity: { type: String }, // Product, Sale...
    entityId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: Object },
    ip: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('ActivityLog', activityLogSchema);
