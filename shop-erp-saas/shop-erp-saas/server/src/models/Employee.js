import mongoose from 'mongoose';

// One instalment of a month's salary being paid (supports paying in parts).
const salaryPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'card'], default: 'cash' },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const salaryRecordSchema = new mongoose.Schema(
  {
    month: { type: String, required: true }, // e.g. "2026-06"
    amount: { type: Number, required: true }, // total salary due for this month
    paidAmount: { type: Number, default: 0 }, // cumulative paid so far (may be less than `amount`)
    status: { type: String, enum: ['paid', 'partial', 'due'], default: 'due' },
    payments: { type: [salaryPaymentSchema], default: [] }, // ledger of each part-payment
    paidAt: { type: Date }, // set once fully paid
  },
  { _id: true }
);

const employeeSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    employeeId: { type: String, index: true }, // auto-generated, e.g. EMP-0001
    // linked login account (nullable — not every employee needs dashboard access)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
