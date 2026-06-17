import mongoose from 'mongoose';

// A single physical phone/device unit, uniquely identified by IMEI / serial.
// Many PhoneUnits belong to one Product (the model/variant). Stock for a
// serial-tracked product = number of units with status 'in_stock'.
const phoneUnitSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    imei1: { type: String, trim: true, default: '' },
    imei2: { type: String, trim: true, default: '' },
    serial: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['in_stock', 'sold'], default: 'in_stock', index: true },
    // sale linkage + warranty (filled in when sold)
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    soldAt: { type: Date, default: null },
    soldPrice: { type: Number, default: 0 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '' },
    warrantyMonths: { type: Number, default: 0 },
    warrantyExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

// Fast IMEI lookup within a business. Uniqueness is enforced in the controller
// (duplicate IMEI is blocked there) to avoid empty-string collisions on units
// that only carry a serial number.
phoneUnitSchema.index({ business: 1, imei1: 1 });
phoneUnitSchema.index({ business: 1, serial: 1 });

export default mongoose.model('PhoneUnit', phoneUnitSchema);
