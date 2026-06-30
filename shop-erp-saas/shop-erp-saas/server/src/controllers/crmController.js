import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import Company from '../models/Company.js';
import Contact from '../models/Contact.js';
import Lead from '../models/Lead.js';
import Deal from '../models/Deal.js';
import CrmTask from '../models/CrmTask.js';
import CrmNote from '../models/CrmNote.js';

// Query params that map to exact-match filters (e.g. ?kind=followup, ?stage=won).
const EXACT_FILTERS = ['status', 'kind', 'stage', 'priority'];
// Reference fields where an empty string from a form select must become null.
const REF_FIELDS = ['company', 'contact'];

const clean = (body, businessId) => {
  const b = { ...body };
  delete b.business; delete b._id; delete b.createdAt; delete b.updatedAt;
  REF_FIELDS.forEach((k) => { if (b[k] === '') b[k] = null; });
  if (businessId) b.business = businessId;
  return b;
};

// Generic tenant-scoped CRUD for a CRM model.
const crud = (Model, { search = [], populate = null } = {}) => ({
  list: asyncHandler(async (req, res) => {
    const q = tenantFilter(req);
    EXACT_FILTERS.forEach((k) => { if (req.query[k]) q[k] = req.query[k]; });
    if (req.query.search && search.length) {
      q.$or = search.map((f) => ({ [f]: { $regex: req.query.search, $options: 'i' } }));
    }
    let query = Model.find(q).sort('-createdAt');
    if (populate) query = query.populate(populate);
    ok(res, { items: await query });
  }),
  create: asyncHandler(async (req, res) => {
    const payload = clean(req.body, req.businessId);
    if (req.user?._id && Model.schema.path('createdBy')) payload.createdBy = req.user._id;
    const item = await Model.create(payload);
    created(res, { item });
  }),
  update: asyncHandler(async (req, res) => {
    const item = await Model.findOneAndUpdate(tenantFilter(req, { _id: req.params.id }), clean(req.body), { new: true });
    if (!item) throw new ApiError(404, 'Not found');
    ok(res, { item });
  }),
  remove: asyncHandler(async (req, res) => {
    const item = await Model.findOneAndDelete(tenantFilter(req, { _id: req.params.id }));
    if (!item) throw new ApiError(404, 'Not found');
    ok(res, {}, 'Deleted');
  }),
});

export const companies = crud(Company, { search: ['name', 'industry', 'phone', 'email'] });
export const contacts = crud(Contact, { search: ['name', 'email', 'phone', 'designation'], populate: { path: 'company', select: 'name' } });
export const leads = crud(Lead, { search: ['name', 'email', 'phone', 'source'] });
export const deals = crud(Deal, { search: ['title'], populate: [{ path: 'contact', select: 'name' }, { path: 'company', select: 'name' }] });
export const tasks = crud(CrmTask, { search: ['title', 'relatedLabel'] });
export const notes = crud(CrmNote, { search: ['body', 'relatedLabel'] });
