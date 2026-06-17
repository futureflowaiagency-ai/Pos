import mongoose from 'mongoose';

const salaryRecordSchema = new mongoose.Schema(
  {
    month: { type: String, required: true }, // e.g. "2026-06"
    amount: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'due'], default: 'due' },
    paidAt: { type: Date },
  },
  { _id: true }
);

const employeeSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    employeeId: { type: String, index: true }, // auto-generated, e.g. EMP-0001
    photo: { type: String, default: '' }, // image URL or data-URL
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    dob: { type: Date },
    designation: { type: String, default: 'Staff' },
    department: { type: String, default: '' },
    address: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    monthlySalary: { type: Number, default: 0 },
    joinDate: { type: Date, default: Date.now },
    salaryHistory: [salaryRecordSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Employee', employeeSchema);
