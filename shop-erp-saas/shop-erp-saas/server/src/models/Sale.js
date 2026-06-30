import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    qty: { type: Number, required: true, default: 1 },
    purchasePrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    sellingPrice: { type: Number, required: true, default: 0 },
    // ---- mobile-shop specific (optional) ----
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'PhoneUnit', default: null },
    imei1: { type: String, default: '' },
    imei2: { type: String, default: '' },
    serial: { type: String, default: '' },
    warrantyMonths: { type: Number, default: 0 }, // combined/effective warranty months
    warrantyExpiry: { type: Date, default: null },
    warrantyBrandMonths: { type: Number, default: 0 },
    warrantyShopMonths: { type: Number, default: 0 },
    warrantyBrandExpiry: { type: Date, default: null },
    warrantyShopExpiry: { type: Date, default: null },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    invoiceNo: { type: String, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: 'Walk-in' },
    customerNid: { type: String, default: '' },
    items: [saleItemSchema],
    subTotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'bkash', 'nagad', 'card', 'due', 'emi'], default: 'cash' },
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

saleSchema.index({ business: 1, createdAt: -1 });

export default mongoose.model('Sale', saleSchema);
