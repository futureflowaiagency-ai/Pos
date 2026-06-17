import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import Employee from '../models/Employee.js';

// Generate the next sequential employee id for a business (collision-safe even after deletes)
const nextEmployeeId = async (businessId) => {
  const docs = await Employee.find({ business: businessId }, 'employeeId').lean();
  let max = 0;
  for (const d of docs) {
    const m = /(\d+)\s*$/.exec(d.employeeId || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return 'EMP-' + String(max + 1).padStart(4, '0');
};

// @route GET /api/employees?status=active|inactive&designation=&search=
export const getEmployees = asyncHandler(async (req, res) => {
  const { status, designation, search } = req.query;
  const q = tenantFilter(req);
  if (status === 'active') q.isActive = true;
  else if (status === 'inactive') q.isActive = false;
  if (designation) q.designation = designation;
  if (search) {
    q.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
      { designation: { $regex: search, $options: 'i' } },
    ];
  }
  const employees = await Employee.find(q).sort('-createdAt');
  ok(res, { employees, count: employees.length });
});

// @route GET /api/employees/:id
export const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!employee) throw new ApiError(404, 'Employee not found');
  ok(res, { employee });
});

// @route POST /api/employees
export const createEmployee = asyncHandler(async (req, res) => {
  const employeeId = req.body.employeeId || (await nextEmployeeId(req.businessId));
  const employee = await Employee.create({ ...req.body, employeeId, business: req.businessId });
  await logActivity(req, { action: 'CREATE_EMPLOYEE', entity: 'Employee', entityId: employee._id, meta: { name: employee.name, employeeId } });
  created(res, { employee });
});

// @route PUT /api/employees/:id
export const updateEmployee = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  delete update.employeeId; // employee id is immutable
  delete update.business;
  const employee = await Employee.findOneAndUpdate(tenantFilter(req, { _id: req.params.id }), update, { new: true, runValidators: true });
  if (!employee) throw new ApiError(404, 'Employee not found');
  await logActivity(req, { action: 'UPDATE_EMPLOYEE', entity: 'Employee', entityId: employee._id });
  ok(res, { employee }, 'Employee updated');
});

// @route PATCH /api/employees/:id/status  body:{ isActive }
export const setEmployeeStatus = asyncHandler(async (req, res) => {
  const isActive = !!req.body.isActive;
  const employee = await Employee.findOneAndUpdate(tenantFilter(req, { _id: req.params.id }), { isActive }, { new: true });
  if (!employee) throw new ApiError(404, 'Employee not found');
  await logActivity(req, { action: isActive ? 'ACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE', entity: 'Employee', entityId: employee._id });
  ok(res, { employee }, `Employee ${isActive ? 'activated' : 'deactivated'}`);
});

// @route DELETE /api/employees/:id  (permanent delete)
export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOneAndDelete(tenantFilter(req, { _id: req.params.id }));
  if (!employee) throw new ApiError(404, 'Employee not found');
  await logActivity(req, { action: 'DELETE_EMPLOYEE', entity: 'Employee', entityId: employee._id, meta: { name: employee.name } });
  ok(res, {}, 'Employee deleted');
});

// pay or record salary for a month
export const paySalary = asyncHandler(async (req, res) => {
  const { month, amount, status = 'paid' } = req.body;
  const employee = await Employee.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!employee) throw new ApiError(404, 'Employee not found');

  const existing = employee.salaryHistory.find((s) => s.month === month);
  if (existing) {
    existing.amount = amount;
    existing.status = status;
    existing.paidAt = status === 'paid' ? new Date() : undefined;
  } else {
    employee.salaryHistory.push({ month, amount, status, paidAt: status === 'paid' ? new Date() : undefined });
  }
  await employee.save();
  await logActivity(req, { action: 'PAY_SALARY', entity: 'Employee', entityId: employee._id, meta: { month, amount, status } });
  ok(res, { employee }, 'Salary recorded');
});
