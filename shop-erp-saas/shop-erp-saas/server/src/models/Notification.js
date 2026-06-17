import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, default: 'info' }, // info | warning | success | error
    title: { type: String, required: true },
    message: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
