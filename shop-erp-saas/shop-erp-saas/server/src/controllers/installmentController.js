import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import Installment from '../models/Installment.js';
import Customer from '../models/Customer.js';

// @route GET /api/installments?status=
export const getInstallments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const q = tenantFilter(req);
  if (status) q.status = status;
  const installments = await Installment.find(q).sort('-createdAt');
  ok(res, { installments, count: installments.length });
});

// @route GET /api/installments/:id
export const getInstallment = asyncHandler(async (req, res) => {
  const installment = await Installment.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!installment) throw new ApiError(404, 'Installment plan not found');
  ok(res, { installment });
});

// @route POST /api/installments
// body: { customer, productName, totalAmount, downPayment, months, firstDueDate }
export const createInstallment = asyncHandler(async (req, res) => {
  const { customer = null, productName = '', totalAmount, downPayment = 0, months, firstDueDate, sale = null } = req.body;
  if (!customer) throw new ApiError(400, 'Customer is required');
  const total = Number(totalAmount || 0);
  const down = Number(downPayment || 0);
  const n = Number(months || 0);
  if (total <= 0) throw new ApiError(400, 'Total amount must be greater than 0');
  if (n < 1) throw new ApiError(400, 'Number of instalments must be at least 1');
  if (down > total) throw new ApiError(400, 'Down payment cannot exceed total amount');

  let customerName = '';
  if (customer) {
    const cust = await Customer.findOne(tenantFilter(req, { _id: customer }));
    if (cust) customerName = cust.name;
  }

  const financed = total - down;
  const per = Math.round((financed / n) * 100) / 100;
  const start = firstDueDate ? new Date(firstDueDate) : new Date();
  const schedule = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    // last instalment absorbs any rounding remainder
    const amount = i === n - 1 ? Math.round((financed - allocated) * 100) / 100 : per;
    allocated += amount;
    schedule.push({ no: i + 1, dueDate: due, amount, paid: false });
  }

  const installment = await Installment.create({
    business: req.businessId,
    customer, customerName, productName, sale,
    totalAmount: total, downPayment: down, months: n,
    schedule, status: 'active', createdBy: req.user._id,
  });
  await logActivity(req, { action: 'CREATE_INSTALLMENT', entity: 'Installment', entityId: installment._id, meta: { total, months: n } });
  created(res, { installment });
});

// @route PATCH /api/installments/:id/pay  body: { no }  -> mark one instalment paid
export const payInstallment = asyncHandler(async (req, res) => {
  const { no } = req.body;
  const installment = await Installment.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!installment) throw new ApiError(404, 'Installment plan not found');
  const row = installment.schedule.find((s) => s.no === Number(no));
  if (!row) throw new ApiError(404, 'Instalment not found');
  if (row.paid) throw new ApiError(400, 'Instalment already paid');
  row.paid = true;
  row.paidAt = new Date();
  if (installment.schedule.every((s) => s.paid)) installment.status = 'completed';
  await installment.save();
  await logActivity(req, { action: 'PAY_INSTALLMENT', entity: 'Installment', entityId: installment._id, meta: { no } });
  ok(res, { installment }, 'Instalment marked paid');
});

// @route DELETE /api/installments/:id
export const deleteInstallment = asyncHandler(async (req, res) => {
  const installment = await Installment.findOneAndDelete(tenantFilter(req, { _id: req.params.id }));
  if (!installment) throw new ApiError(404, 'Installment plan not found');
  await logActivity(req, { action: 'DELETE_INSTALLMENT', entity: 'Installment', entityId: installment._id });
  ok(res, {}, 'Installment plan deleted');
});
