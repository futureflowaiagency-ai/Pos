import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import PhoneUnit from '../models/PhoneUnit.js';

const genInvoiceNo = () =>
  'INV-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 90 + 10);

// @route POST /api/sales  (POS checkout)
// body: { items:[{product, qty, unit?}], discount, paid, paymentMethod, customer, customerName, customerPhone, customerNid }
export const createSale = asyncHandler(async (req, res) => {
  const { items = [], discount = 0, paid = 0, paymentMethod = 'cash', customer = null, customerName: reqName = '', customerPhone = '', customerNid = '' } = req.body;
  if (!items.length) throw new ApiError(400, 'No items in sale');
  // Walk-in is removed: a sale must always be tied to a customer (by id, or by name + phone).
  if (!customer && !(String(reqName).trim() && String(customerPhone).trim()))
    throw new ApiError(400, 'Customer name and phone are required');

  const session = await mongoose.startSession();
  let sale;
  try {
    await session.withTransaction(async () => {
      const lineItems = [];
      const soldUnits = []; // { unit, warrantyMonths, warrantyExpiry, sellingPrice }
      let subTotal = 0;
      let profit = 0;

      for (const it of items) {
        const product = await Product.findOne(tenantFilter(req, { _id: it.product })).session(session);
        if (!product) throw new ApiError(404, `Product not found: ${it.product}`);

        // apply the product's percentage discount to get the effective selling price
        const pct = Math.min(Math.max(product.discountPercent || 0, 0), 100);
        const unitPrice = Math.round((product.sellingPrice * (1 - pct / 100)) * 100) / 100;

        const line = {
          product: product._id,
          name: product.name,
          qty: it.qty,
          purchasePrice: product.purchasePrice,
          mrp: product.sellingPrice,
          discountPercent: pct,
          sellingPrice: unitPrice,
        };

        if (it.unit) {
          // serial-tracked (mobile) line — exactly one specific device by IMEI
          const unit = await PhoneUnit.findOne(tenantFilter(req, { _id: it.unit })).session(session);
          if (!unit) throw new ApiError(404, 'Selected device unit not found');
          if (unit.status === 'sold') throw new ApiError(400, `Device ${unit.imei1 || unit.serial} is already sold`);
          if (String(unit.product) !== String(product._id)) throw new ApiError(400, 'Unit does not match product');

          line.qty = 1;
          const wMonths = Math.max(product.warrantyBrandMonths || 0, product.warrantyShopMonths || 0);
          const wExpiry = wMonths > 0 ? new Date(Date.now() + wMonths * 30 * 24 * 60 * 60 * 1000) : null;
          line.unit = unit._id;
          line.imei1 = unit.imei1;
          line.imei2 = unit.imei2;
          line.serial = unit.serial;
          line.warrantyMonths = wMonths;
          line.warrantyExpiry = wExpiry;

          subTotal += unitPrice;
          profit += unitPrice - product.purchasePrice;
          product.stock = Math.max(0, product.stock - 1);
          await product.save({ session });
          soldUnits.push({ unit, warrantyMonths: wMonths, warrantyExpiry: wExpiry, sellingPrice: unitPrice });
        } else {
          // standard quantity-based line
          if (product.stock < it.qty) throw new ApiError(400, `Insufficient stock for ${product.name}`);
          subTotal += unitPrice * it.qty;
          profit += (unitPrice - product.purchasePrice) * it.qty;
          product.stock -= it.qty;
          await product.save({ session });
        }

        lineItems.push(line);
      }

      const total = Math.max(0, subTotal - discount);
      const due = Math.max(0, total - paid);

      // Resolve the customer — find an existing one (by id or phone) or create a
      // new record on the fly. This keeps dues attached and lets old invoices be
      // looked up by phone number later.
      let custDoc = null;
      if (customer) custDoc = await Customer.findOne(tenantFilter(req, { _id: customer })).session(session);
      if (!custDoc && customerPhone) custDoc = await Customer.findOne(tenantFilter(req, { phone: String(customerPhone).trim() })).session(session);
      if (!custDoc && (reqName || customerPhone)) {
        [custDoc] = await Customer.create([{
          business: req.businessId,
          name: String(reqName).trim() || 'Customer',
          phone: String(customerPhone).trim(),
          nid: customerNid || '',
        }], { session });
      }

      const customerName = custDoc?.name || String(reqName).trim() || 'Walk-in';
      const nid = customerNid || custDoc?.nid || '';
      if (custDoc) {
        if (customerNid && !custDoc.nid) custDoc.nid = customerNid; // backfill NID captured at sale
        if (due > 0) custDoc.totalDue += due;
        await custDoc.save({ session });
      }

      [sale] = await Sale.create([{
        business: req.businessId,
        invoiceNo: genInvoiceNo(),
        customer: custDoc?._id || null,
        customerName,
        customerNid: nid,
        items: lineItems,
        subTotal, discount, total, paid, due,
        profit: profit - discount, // discount reduces realized profit
        paymentMethod: due > 0 ? 'due' : paymentMethod,
        soldBy: req.user._id,
      }], { session });

      // mark each sold device unit as sold + stamp warranty
      for (const su of soldUnits) {
        su.unit.status = 'sold';
        su.unit.sale = sale._id;
        su.unit.soldAt = sale.createdAt || new Date();
        su.unit.soldPrice = su.sellingPrice;
        su.unit.customer = custDoc?._id || null;
        su.unit.customerName = customerName;
        su.unit.warrantyMonths = su.warrantyMonths;
        su.unit.warrantyExpiry = su.warrantyExpiry;
        await su.unit.save({ session });
      }
    });
  } finally {
    session.endSession();
  }

  await logActivity(req, { action: 'CREATE_SALE', entity: 'Sale', entityId: sale._id, meta: { invoiceNo: sale.invoiceNo, total: sale.total } });
  created(res, { sale });
});

// @route GET /api/sales?from=&to=
export const getSales = asyncHandler(async (req, res) => {
  const { from, to, limit = 100 } = req.query;
  const q = tenantFilter(req);
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to + 'T23:59:59');
  }
  const sales = await Sale.find(q).sort('-createdAt').limit(Number(limit));
  ok(res, { sales, count: sales.length });
});

// @route GET /api/sales/:id
export const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!sale) throw new ApiError(404, 'Sale not found');
  ok(res, { sale });
});

// @route GET /api/sales/report?period=daily|monthly
export const salesReport = asyncHandler(async (req, res) => {
  const { period = 'daily' } = req.query;
  const fmt = period === 'monthly' ? '%Y-%m' : '%Y-%m-%d';
  const report = await Sale.aggregate([
    { $match: { business: new mongoose.Types.ObjectId(req.businessId) } },
    {
      $group: {
        _id: { $dateToString: { format: fmt, date: '$createdAt' } },
        totalSales: { $sum: '$total' },
        totalProfit: { $sum: '$profit' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 31 },
  ]);
  ok(res, { period, report: report.reverse() });
});
