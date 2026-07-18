import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import { parseCSV } from '../utils/csv.js';
import { parseUploadedFile } from '../utils/smartImport.js';
import ImportExportLog from '../models/ImportExportLog.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Expense from '../models/Expense.js';
import PhoneUnit from '../models/PhoneUnit.js';

const TENDERS = ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'card'];
const toBool = (v) => ['true', '1', 'yes', 'y'].includes(String(v ?? '').trim().toLowerCase());
const num = (v, def) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// header row + one example row — lets a shop owner migrating from another
// system know exactly which columns to fill in (req 13 "নির্ধারিত Template").
const TEMPLATES = {
  customers: { columns: ['name', 'phone', 'email', 'address', 'nid'], example: ['Rahim Uddin', '01711000000', 'rahim@example.com', 'Dhaka', '1234567890'] },
  suppliers: { columns: ['name', 'phone', 'address', 'note'], example: ['ABC Distributors', '01911000000', 'Motijheel, Dhaka', 'Main phone supplier'] },
  products: {
    columns: ['name', 'barcode', 'sku', 'category', 'unit', 'purchasePrice', 'sellingPrice', 'discountPercent', 'stock', 'lowStockAlert', 'trackSerial', 'brand', 'color', 'storage', 'returnable'],
    example: ['iPhone 13', '', 'IP13-BLK', 'Mobile', 'pcs', '55000', '62000', '0', '5', '2', 'true', 'Apple', 'Black', '128GB', 'true'],
  },
  expenses: { columns: ['title', 'category', 'amount', 'source', 'note', 'date'], example: ['Shop Rent', 'Rent', '15000', 'cash', 'July rent', ''] },
  units: { columns: ['imei1', 'imei2', 'serial'], example: ['356789012345678', '', ''] },
};

// @route GET /api/import/:entity/template
export const downloadTemplate = asyncHandler(async (req, res) => {
  const t = TEMPLATES[req.params.entity];
  if (!t) throw new ApiError(400, `Unknown import entity: ${req.params.entity}`);
  const csv = [t.columns.join(','), t.example.join(',')].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.entity}-template.csv"`);
  res.send(csv);
});

// ---- per-row validators: return { ok:true, data } or { ok:false, message } ----
function validateCustomerRow(row) {
  if (!row.name?.trim()) return { ok: false, message: 'Name is required' };
  return { ok: true, data: { name: row.name.trim(), phone: row.phone?.trim() || '', email: row.email?.trim() || '', address: row.address?.trim() || '', nid: row.nid?.trim() || '' } };
}
function validateSupplierRow(row) {
  if (!row.name?.trim()) return { ok: false, message: 'Name is required' };
  return { ok: true, data: { name: row.name.trim(), phone: row.phone?.trim() || '', address: row.address?.trim() || '', note: row.note?.trim() || '' } };
}
function validateProductRow(row) {
  if (!row.name?.trim()) return { ok: false, message: 'Name is required' };
  const purchasePrice = num(row.purchasePrice, NaN);
  const sellingPrice = num(row.sellingPrice, NaN);
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) return { ok: false, message: 'Purchase Price must be a non-negative number' };
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) return { ok: false, message: 'Selling Price must be a non-negative number' };
  return {
    ok: true,
    data: {
      name: row.name.trim(), barcode: row.barcode?.trim() || '', sku: row.sku?.trim() || '',
      category: row.category?.trim() || 'General', unit: row.unit?.trim() || 'pcs',
      purchasePrice, sellingPrice, discountPercent: Math.min(100, Math.max(0, num(row.discountPercent, 0))),
      stock: num(row.stock, 0), lowStockAlert: num(row.lowStockAlert, 5),
      trackSerial: toBool(row.trackSerial), brand: row.brand?.trim() || '', color: row.color?.trim() || '', storage: row.storage?.trim() || '',
      returnable: row.returnable === undefined || row.returnable === '' ? true : toBool(row.returnable),
    },
  };
}
function validateExpenseRow(row) {
  if (!row.title?.trim()) return { ok: false, message: 'Title is required' };
  const amount = num(row.amount, NaN);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Amount must be greater than 0' };
  const source = TENDERS.includes((row.source || '').toLowerCase()) ? row.source.toLowerCase() : 'cash';
  const date = row.date && !Number.isNaN(new Date(row.date).getTime()) ? new Date(row.date) : new Date();
  return { ok: true, data: { title: row.title.trim(), category: row.category?.trim() || 'General', amount, source, note: row.note?.trim() || '', date } };
}
// units also checks against the DB (not just the file) — the most business-critical
// duplicate to catch before committing, so it's verified during the dry-run too.
async function validateUnitRow(row, seen, req) {
  const imei1 = row.imei1?.trim() || '';
  const imei2 = row.imei2?.trim() || '';
  const serial = row.serial?.trim() || '';
  if (!imei1 && !serial) return { ok: false, message: 'Each row needs an IMEI 1 or a Serial number' };
  const key = imei1 || serial;
  if (seen.has(key)) return { ok: false, message: `Duplicate IMEI/serial in file: ${key}` };
  seen.add(key);
  const clash = await PhoneUnit.findOne(tenantFilter(req, { $or: [...(imei1 ? [{ imei1 }] : []), ...(serial ? [{ serial }] : [])] }));
  if (clash) return { ok: false, message: `Already exists in this shop: ${key}` };
  return { ok: true, data: { imei1, imei2, serial } };
}

async function runValidation(entity, csvText, req) {
  const rawRows = parseCSV(csvText);
  if (!rawRows.length) throw new ApiError(400, 'The file is empty or has no data rows');

  let results;
  if (entity === 'customers') results = rawRows.map(validateCustomerRow);
  else if (entity === 'suppliers') results = rawRows.map(validateSupplierRow);
  else if (entity === 'products') results = rawRows.map(validateProductRow);
  else if (entity === 'expenses') results = rawRows.map(validateExpenseRow);
  else if (entity === 'units') { const seen = new Set(); results = await Promise.all(rawRows.map((r) => validateUnitRow(r, seen, req))); }
  else throw new ApiError(400, `Unknown import entity: ${entity}`);

  const errors = [];
  const valid = [];
  results.forEach((r, i) => {
    if (r.ok) valid.push(r.data);
    else errors.push({ row: i + 2, message: r.message }); // +2: header row + 1-indexed
  });
  return { total: rawRows.length, valid, errors };
}

// @route POST /api/import/:entity/validate  body: { csv }
export const validateImport = asyncHandler(async (req, res) => {
  const { csv } = req.body;
  if (!csv) throw new ApiError(400, 'No file content received');
  const { total, valid, errors } = await runValidation(req.params.entity, csv, req);
  ok(res, { total, validCount: valid.length, errorCount: errors.length, errors: errors.slice(0, 200) });
});

// @route POST /api/import/:entity/commit  body: { csv, product? }
// Re-validates (never trusts a stale client-side dry-run), then writes. Existing
// records are upserted by a natural key (phone/name/barcode) so re-importing the
// same file is safe and doesn't create duplicates.
export const commitImport = asyncHandler(async (req, res) => {
  const { entity } = req.params;
  const { csv } = req.body;
  if (!csv) throw new ApiError(400, 'No file content received');
  const { valid, errors } = await runValidation(entity, csv, req);

  let createdCount = 0, updatedCount = 0;
  if (entity === 'customers') {
    for (const data of valid) {
      const existing = data.phone ? await Customer.findOne(tenantFilter(req, { phone: data.phone })) : null;
      if (existing) { Object.assign(existing, data); await existing.save(); updatedCount++; }
      else { await Customer.create({ ...data, business: req.businessId }); createdCount++; }
    }
  } else if (entity === 'suppliers') {
    for (const data of valid) {
      const existing = await Supplier.findOne(tenantFilter(req, { name: data.name }));
      if (existing) { Object.assign(existing, data); await existing.save(); updatedCount++; }
      else { await Supplier.create({ ...data, business: req.businessId }); createdCount++; }
    }
  } else if (entity === 'products') {
    for (const data of valid) {
      const existing = data.barcode ? await Product.findOne(tenantFilter(req, { barcode: data.barcode })) : null;
      if (existing) { Object.assign(existing, data); await existing.save(); updatedCount++; }
      else { await Product.create({ ...data, business: req.businessId }); createdCount++; }
    }
  } else if (entity === 'expenses') {
    for (const data of valid) { await Expense.create({ ...data, business: req.businessId }); createdCount++; }
  } else if (entity === 'units') {
    const { product } = req.body;
    if (!product) throw new ApiError(400, 'Select a product for the IMEI/serial import');
    const prod = await Product.findOne(tenantFilter(req, { _id: product }));
    if (!prod) throw new ApiError(404, 'Product not found');
    for (const data of valid) {
      await PhoneUnit.create({ ...data, business: req.businessId, product: prod._id, status: 'in_stock' });
      createdCount++;
    }
    if (createdCount > 0) {
      const inStock = await PhoneUnit.countDocuments(tenantFilter(req, { product: prod._id, status: 'in_stock' }));
      await Product.updateOne(tenantFilter(req, { _id: prod._id }), { stock: inStock, trackSerial: true });
    }
  }

  await ImportExportLog.create({ business: req.businessId, action: 'import', entity, format: 'csv', recordCount: createdCount + updatedCount, errorCount: errors.length, createdBy: req.user._id });
  await logActivity(req, { action: 'IMPORT_DATA', entity: 'Import', meta: { entity, created: createdCount, updated: updatedCount, errors: errors.length } });
  ok(res, { created: createdCount, updated: updatedCount, skipped: errors.length, errors: errors.slice(0, 200) }, 'Import complete');
});

// Turns a raw parsed row (from any file shape) into clean product-migration
// data, or an error message. Stock/prices default to 0 when the source file
// doesn't have them (e.g. this shop's old software never recorded prices) —
// the owner fills those in afterward from the normal Edit Product screen.
function normalizeSmartRow(row) {
  const name = String(row.name || '').trim();
  if (!name) return { ok: false, message: 'Missing product name' };
  const category = String(row.category || '').trim().replace(/^\(+\s*/, '').replace(/\s*\)+$/, '').trim() || 'General';
  return {
    ok: true,
    data: {
      supplierName: String(row.supplierName || '').trim(),
      name,
      category,
      stock: Math.max(0, Math.round(num(row.stock, 0))),
      barcode: String(row.barcode || '').trim(),
      sku: String(row.sku || '').trim(),
      purchasePrice: Math.max(0, num(row.purchasePrice, 0)),
      sellingPrice: Math.max(0, num(row.sellingPrice, 0)),
    },
  };
}

function runSmartValidation(req) {
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const { rows, format } = parseUploadedFile(req.file.buffer, req.file.originalname);
  if (!rows.length) throw new ApiError(400, 'Could not find any product rows in this file — check it has a Name/Item column');
  const results = rows.map(normalizeSmartRow);
  const errors = [];
  const valid = [];
  results.forEach((r, i) => { if (r.ok) valid.push(r.data); else errors.push({ row: i + 2, message: r.message }); });
  return { format, total: rows.length, valid, errors };
}

// @route POST /api/import/smart/preview  (multipart, field: file)
// Dry-run for the "Smart Stock Import" — accepts any file shape (this shop's
// old-software HTML-as-.xls export, a real .xlsx/.xls, or CSV/TXT with
// whatever column names) and previews what it understood before writing anything.
export const smartImportPreview = asyncHandler(async (req, res) => {
  const { format, total, valid, errors } = runSmartValidation(req);
  const suppliers = [...new Set(valid.map((v) => v.supplierName).filter(Boolean))].sort();
  const withPrices = valid.some((v) => v.purchasePrice > 0 || v.sellingPrice > 0);
  ok(res, {
    format, total, validCount: valid.length, errorCount: errors.length,
    errors: errors.slice(0, 200), suppliers, sample: valid.slice(0, 20), withPrices,
  });
});

// @route POST /api/import/smart/commit  (multipart, field: file)
// Find-or-creates a Supplier per distinct name, upserts each Product by
// name+category (no barcode/SKU in this kind of legacy data), sets stock and
// links the supplier. This is a historical-data migration, not a live
// transaction — no Purchase/Expense is booked (unlike the Add-Product-with-
// supplier flow), since there's no real payment happening right now.
export const smartImportCommit = asyncHandler(async (req, res) => {
  const { valid, errors } = runSmartValidation(req);

  const supplierCache = new Map();
  let createdProducts = 0, updatedProducts = 0, createdSuppliers = 0;

  for (const data of valid) {
    let supplierDoc = null;
    if (data.supplierName) {
      const key = data.supplierName.toLowerCase();
      if (supplierCache.has(key)) {
        supplierDoc = supplierCache.get(key);
      } else {
        supplierDoc = await Supplier.findOne(tenantFilter(req, { name: { $regex: `^${escapeRegex(data.supplierName)}$`, $options: 'i' } }));
        if (!supplierDoc) {
          supplierDoc = await Supplier.create({ business: req.businessId, name: data.supplierName });
          createdSuppliers++;
        }
        supplierCache.set(key, supplierDoc);
      }
    }

    const existing = await Product.findOne(tenantFilter(req, {
      name: { $regex: `^${escapeRegex(data.name)}$`, $options: 'i' }, category: data.category,
    }));
    if (existing) {
      existing.stock = data.stock;
      if (supplierDoc) existing.supplier = supplierDoc._id;
      if (data.purchasePrice) existing.purchasePrice = data.purchasePrice;
      if (data.sellingPrice) existing.sellingPrice = data.sellingPrice;
      if (data.barcode) existing.barcode = data.barcode;
      if (data.sku) existing.sku = data.sku;
      await existing.save();
      updatedProducts++;
    } else {
      await Product.create({
        business: req.businessId, name: data.name, category: data.category, stock: data.stock,
        purchasePrice: data.purchasePrice, sellingPrice: data.sellingPrice,
        barcode: data.barcode || undefined, sku: data.sku,
        supplier: supplierDoc?._id || null,
      });
      createdProducts++;
    }
  }

  await ImportExportLog.create({
    business: req.businessId, action: 'import', entity: 'smart-products', format: 'auto',
    recordCount: createdProducts + updatedProducts, errorCount: errors.length, createdBy: req.user._id,
  });
  await logActivity(req, {
    action: 'IMPORT_DATA', entity: 'Import',
    meta: { entity: 'smart-products', created: createdProducts, updated: updatedProducts, suppliersCreated: createdSuppliers, errors: errors.length },
  });
  ok(res, { createdProducts, updatedProducts, createdSuppliers, skipped: errors.length, errors: errors.slice(0, 200) }, 'Import complete');
});

// @route POST /api/import/backup/restore  body: { json }
// Additive-only restore of the foundational (non-relational) entities from a
// full backup — Products, Customers, Suppliers, Expenses. Sales/Purchases/
// Installments/Returns reference other collections and would need id-remapping
// to stay consistent, so they're exported for record-keeping/migration but not
// auto-restored here — re-enter transactional history by hand if ever needed.
export const restoreBackup = asyncHandler(async (req, res) => {
  const { json } = req.body;
  if (!json || typeof json !== 'object') throw new ApiError(400, 'Invalid backup file');
  const strip = (doc) => { const { _id, business, createdAt, updatedAt, __v, ...rest } = doc; return rest; };

  const counts = { products: 0, customers: 0, suppliers: 0, expenses: 0 };
  for (const p of json.products || []) { await Product.create({ ...strip(p), business: req.businessId }); counts.products++; }
  for (const c of json.customers || []) { await Customer.create({ ...strip(c), business: req.businessId }); counts.customers++; }
  for (const s of json.suppliers || []) { await Supplier.create({ ...strip(s), business: req.businessId }); counts.suppliers++; }
  for (const e of json.expenses || []) { await Expense.create({ ...strip(e), business: req.businessId }); counts.expenses++; }

  const recordCount = Object.values(counts).reduce((a, b) => a + b, 0);
  await ImportExportLog.create({ business: req.businessId, action: 'restore', entity: 'full', format: 'json', recordCount, createdBy: req.user._id });
  await logActivity(req, { action: 'RESTORE_BACKUP', entity: 'Business', meta: counts });
  ok(res, { counts }, 'Backup restored (Products, Customers, Suppliers, Expenses)');
});
