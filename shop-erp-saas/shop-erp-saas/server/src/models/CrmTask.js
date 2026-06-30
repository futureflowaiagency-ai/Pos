import mongoose from 'mongoose';

// Backs both "Tasks" and "Follow Ups" (distinguished by `kind`).
const crmTaskSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['task', 'followup'], default: 'task' },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
    relatedLabel: { type: String, trim: true, default: '' }, // e.g. "Lead: Karim" / "Deal: Bulk order"
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('CrmTask', crmTaskSchema);
