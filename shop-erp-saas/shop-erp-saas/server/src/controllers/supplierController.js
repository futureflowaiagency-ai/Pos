import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';

// @route GET /api/suppliers?search=
export const getSuppliers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const q = tenantFilter(req, { isActive: true });
  if (search) q.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
  const suppliers = await Supplier.find(q).sort('-createdAt');
  ok(res, { suppliers, count: suppliers.length });
});

// @route POST /api/suppliers
export const createSupplier = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) throw new ApiError(400, 'Supplier name is required');
  const supplier = await Supplier.create({ ...req.body, business: req.businessId });
  await logActivity(req, { action: 'CREATE_SUPPLIER', entity: 'Supplier', entityId: supplier._id, meta: { name: supplier.name } });
  created(res, { supplier });
});

// @route PUT /api/suppliers/:id
export const updateSupplier = asyncHandler(async (req, res) => {
  // running totals are managed by purchase/payment entries, not direct edits
  const { totalPurchase, totalPaid, ...rest } = req.body;
  const supplier = await Supplier.findOneAndUpdate(tenantFilter(req, { _id: req.params.id }), rest, { new: true });
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  await logActivity(req, { action: 'UPDATE_SUPPLIER', entity: 'Supplier', entityId: supplier._id });
  ok(res, { supplier }, 'Supplier updated');
});

// @route DELETE /api/suppliers/:id  (soft delete)
export const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOneAndUpdate(tenantFilter(req, { _id: req.params.id }), { isActive: false }, { new: true });
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  await logActivity(req, { action: 'DELETE_SUPPLIER', entity: 'Supplier', entityId: supplier._id });
  ok(res, {}, 'Supplier deleted');
});

// @route GET /api/suppliers/:id  -> supplier + purchase/payment ledger
export const supplierLedger = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  const entries = await Purchase.find(tenantFilter(req, { supplier: supplier._id })).sort('-createdAt');
  ok(res, { supplier, entries });
});

// @route POST /api/suppliers/:id/purchase
// body: { items:[{name, qty, unitCost}], reference, note, paid }
export const recordPurchase = asyncHandler(async (req, res) => {
  const { items = [], reference = '', note = '', paid = 0 } = req.body;
  const supplier = await Supplier.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const total = items.reduce((s, it) => s + Number(it.unitCost || 0) * Number(it.qty || 0), 0);
  if (total <= 0) throw new ApiError(400, 'Purchase total must be greater than 0');
  const paidAmt = Math.min(Number(paid || 0), total);

  const purchase = await Purchase.create({
    business: req.businessId,
    supplier: supplier._id,
    kind: 'purchase',
    reference, note,
    items: items.map((it) => ({ name: it.name, qty: Number(it.qty || 0), unitCost: Number(it.unitCost || 0) })),
    total,
    paid: paidAmt,
    due: Math.max(0, total - paidAmt),
    createdBy: req.user._id,
  });

  supplier.totalPurchase += total;
  supplier.totalPaid += paidAmt;
  await supplier.save();

  await logActivity(req, { action: 'RECORD_PURCHASE', entity: 'Supplier', entityId: supplier._id, meta: { total, paid: paidAmt } });
  created(res, { purchase, supplier });
});

// @route POST /api/suppliers/:id/pay  body: { amount, note }
export const paySupplier = asyncHandler(async (req, res) => {
  const { amount, note = '' } = req.body;
  const amt = Number(amount || 0);
  if (amt <= 0) throw new ApiError(400, 'Payment amount must be greater than 0');
  const supplier = await Supplier.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const payment = await Purchase.create({
    business: req.businessId,
    supplier: supplier._id,
    kind: 'payment',
    note,
    items: [],
    total: 0,
    paid: amt,
    due: 0,
    createdBy: req.user._id,
  });

  supplier.totalPaid += amt;
  await supplier.save();

  await logActivity(req, { action: 'PAY_SUPPLIER', entity: 'Supplier', entityId: supplier._id, meta: { amount: amt } });
  ok(res, { payment, supplier }, 'Payment recorded');
});
