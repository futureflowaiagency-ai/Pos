import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    no: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true, default: 0 },
    paid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
  },
  { _id: false }
);

// An EMI / instalment plan for a mobile sale (or any large-ticket sale).
const installmentSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '' },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    productName: { type: String, default: '' }, // free-text label of what was financed
    totalAmount: { type: Number, required: true, default: 0 },
    downPayment: { type: Number, default: 0 },
    months: { type: Number, default: 1 }, // number of instalments
    schedule: [scheduleSchema],
    status: { type: String, enum: ['active', 'completed'], default: 'active', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// outstanding balance = total - down payment - sum(paid instalments)
installmentSchema.virtual('balance').get(function () {
  const paid = (this.schedule || []).filter((s) => s.paid).reduce((a, s) => a + s.amount, 0);
  return Math.max(0, (this.totalAmount || 0) - (this.downPayment || 0) - paid);
});
installmentSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Installment', installmentSchema);
