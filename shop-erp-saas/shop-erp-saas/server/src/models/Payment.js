import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    plan: { type: String, enum: ['monthly', 'half_yearly', 'yearly'], required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['bkash', 'nagad', 'manual'], required: true },
    senderNumber: { type: String, trim: true },
    trxId: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
