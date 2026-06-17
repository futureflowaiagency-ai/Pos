import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';

export const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const q = tenantFilter(req, { isActive: true });
  if (search) q.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
  const customers = await Customer.find(q).sort('-createdAt');
  ok(res, { customers, count: customers.length });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create({ ...req.body, business: req.businessId });
  await logActivity(req, { action: 'CREATE_CUSTOMER', entity: 'Customer', entityId: customer._id });
  created(res, { customer });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndUpdate(tenantFilter(req, { _id: req.params.id }), req.body, { new: true });
  if (!customer) throw new ApiError(404, 'Customer not found');
  ok(res, { customer }, 'Customer updated');
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndUpdate(tenantFilter(req, { _id: req.params.id }), { isActive: false }, { new: true });
  if (!customer) throw new ApiError(404, 'Customer not found');
  ok(res, {}, 'Customer deleted');
});

// purchase history + due
export const customerHistory = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!customer) throw new ApiError(404, 'Customer not found');
  const sales = await Sale.find(tenantFilter(req, { customer: customer._id })).sort('-createdAt');
  ok(res, { customer, sales });
});

// record a due payment (customer pays back)
export const collectDue = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const customer = await Customer.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!customer) throw new ApiError(404, 'Customer not found');
  customer.totalDue = Math.max(0, customer.totalDue - Number(amount || 0));
  await customer.save();
  await logActivity(req, { action: 'COLLECT_DUE', entity: 'Customer', entityId: customer._id, meta: { amount } });
  ok(res, { customer }, 'Due collected');
});
