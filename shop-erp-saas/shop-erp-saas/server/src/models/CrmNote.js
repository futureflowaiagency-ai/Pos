import mongoose from 'mongoose';

const crmNoteSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    body: { type: String, required: true },
    relatedLabel: { type: String, trim: true, default: '' }, // what/who this note is about
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('CrmNote', crmNoteSchema);
