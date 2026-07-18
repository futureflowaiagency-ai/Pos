import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { tenantFilter } from '../middleware/tenant.js';
import { logActivity } from '../middleware/activityLogger.js';
import Product from '../models/Product.js';
import PhoneUnit from '../models/PhoneUnit.js';
import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import MarketingSettings from '../models/MarketingSettings.js';
import { decryptSecret } from '../utils/secretCrypto.js';
import { generateVision, hasVisionAI } from '../services/aiService.js';

const TENDERS = ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'card'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const SCAN_PROMPT = `You are looking at a photo of a mobile phone, its retail box, or its IMEI/serial sticker label.
Extract exactly what is printed or visible — do not guess or invent anything you cannot actually read.
Respond with ONLY a JSON object, no markdown, no explanation, in exactly this shape:
{"name": "", "brand": "", "storage": "", "color": "", "imei1": "", "imei2": ""}
- "name": the product/model name as printed (e.g. "Samsung Galaxy A15", "iPhone 13 Pro")
- "brand": manufacturer if identifiable (e.g. "Samsung", "Apple")
- "storage": RAM/ROM if printed (e.g. "4/128GB")
- "color": color if printed
- "imei1"/"imei2": 15-digit IMEI numbers if visible
Leave any field as an empty string "" if it is not clearly visible in the image.`;

function extractScanJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new ApiError(422, "Couldn't read this image clearly — try a clearer photo of the label/box");
  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch { throw new ApiError(422, "Couldn't read this image clearly — try a clearer photo of the label/box"); }
}

// Generate a barcode value that's unique within the business.
const genBarcodeValue = () => String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 900 + 100));
const uniqueBarcode = async (req) => {
  for (let i = 0; i < 8; i++) {
    const code = genBarcodeValue();
    const clash = await Product.findOne(tenantFilter(req, { barcode: code }));
    if (!clash) return code;
  }
  return genBarcodeValue() + String(Math.floor(Math.random() * 9)); // extremely unlikely fallback
};

// @route GET /api/products?search=&category=&lowStock=true
export const getProducts = asyncHandler(async (req, res) => {
  const { search, category, lowStock } = req.query;
  const q = tenantFilter(req, { isActive: true });
  if (search) q.$or = [
    { name: { $regex: search, $options: 'i' } },
    { sku: { $regex: search, $options: 'i' } },
    { barcode: { $regex: search, $options: 'i' } },
  ];
  if (category) q.category = category;

  let products = await Product.find(q).sort('-createdAt').populate('supplier', 'name');
  if (lowStock === 'true') products = products.filter((p) => p.stock <= p.lowStockAlert);
  ok(res, { products, count: products.length });
});

// @route GET /api/products/barcode/:code  — resolve a product by its barcode (scan)
export const getProductByBarcode = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!code) throw new ApiError(400, 'Barcode is required');
  const product = await Product.findOne(tenantFilter(req, { barcode: code, isActive: true }));
  if (!product) throw new ApiError(404, 'No product found for this barcode');
  ok(res, { product });
});

// @route POST /api/products
export const createProduct = asyncHandler(async (req, res) => {
  const isMedicine = /medicine|medicin|drug|pharma/i.test(req.body.category || '');
  if (isMedicine && !req.body.expiryDate) {
    throw new ApiError(400, 'Expiry date is required for medicines');
  }
  // reuse a provided barcode (must be free) or auto-generate a unique one
  let barcode = String(req.body.barcode || '').trim();
  if (barcode) {
    const clash = await Product.findOne(tenantFilter(req, { barcode }));
    if (clash) throw new ApiError(409, 'Barcode already in use by another product');
  } else {
    barcode = await uniqueBarcode(req);
  }
  const product = await Product.create({ ...req.body, barcode, business: req.businessId });
  await logActivity(req, { action: 'CREATE_PRODUCT', entity: 'Product', entityId: product._id, meta: { name: product.name } });
  created(res, { product });
});

// @route POST /api/products/batch-with-supplier
// Add one or more products in one go, all received from the same supplier/dealer —
// auto-creates (or reuses) the Supplier and records a single stock-in Purchase
// linking every created product, so it shows up in the Supplier dashboard/ledger.
// body: { supplierName, supplierPhone?, reference?, note?, paid?, source?,
//         items:[{ ...productFields, imeis?:[{imei1,imei2,serial}] }] }
export const createProductsWithSupplier = asyncHandler(async (req, res) => {
  const { supplierName = '', supplierPhone = '', reference = '', note = '', paid = 0, source = 'cash', items = [] } = req.body;
  if (!String(supplierName).trim()) throw new ApiError(400, 'Supplier / dealer name is required');
  if (!items.length) throw new ApiError(400, 'At least one item is required');

  // find-or-create the supplier (case-insensitive name match within this business)
  let supplier = await Supplier.findOne(tenantFilter(req, { name: { $regex: `^${escapeRegex(String(supplierName).trim())}$`, $options: 'i' } }));
  if (!supplier) {
    supplier = await Supplier.create({ business: req.businessId, name: String(supplierName).trim(), phone: String(supplierPhone || '').trim() });
  } else if (String(supplierPhone || '').trim() && !supplier.phone) {
    supplier.phone = String(supplierPhone).trim();
    await supplier.save();
  }

  // de-dupe IMEI/serial across the whole submitted batch before touching the DB
  const allCodes = [];
  for (const raw of items) {
    if (!raw.trackSerial) continue;
    for (const u of (raw.imeis || [])) {
      const code = (u.imei1 || u.serial || '').trim();
      if (code) allCodes.push(code);
    }
  }
  const dupInBatch = allCodes.find((c, i) => allCodes.indexOf(c) !== i);
  if (dupInBatch) throw new ApiError(400, `Duplicate IMEI/serial in this submission: ${dupInBatch}`);
  if (allCodes.length) {
    const existing = await PhoneUnit.findOne(tenantFilter(req, { $or: [{ imei1: { $in: allCodes } }, { serial: { $in: allCodes } }] }));
    if (existing) throw new ApiError(409, `IMEI/serial already exists: ${existing.imei1 || existing.serial}`);
  }

  const createdProducts = [];
  const purchaseItems = [];
  let total = 0;

  for (const raw of items) {
    const name = String(raw.name || '').trim();
    if (!name) throw new ApiError(400, 'Every item needs a name');
    const isMedicine = /medicine|medicin|drug|pharma/i.test(raw.category || '');
    if (isMedicine && !raw.expiryDate) throw new ApiError(400, `Expiry date is required for medicine: ${name}`);

    let barcode = String(raw.barcode || '').trim();
    if (barcode) {
      const clash = await Product.findOne(tenantFilter(req, { barcode }));
      if (clash) throw new ApiError(409, `Barcode already in use: ${barcode}`);
    } else {
      barcode = await uniqueBarcode(req);
    }

    const trackSerial = !!raw.trackSerial;
    const imeis = trackSerial ? (raw.imeis || []).filter((u) => (u.imei1 || u.serial || '').trim()) : [];
    if (trackSerial && imeis.length === 0) throw new ApiError(400, `Add at least one IMEI/serial for ${name}`);
    const qty = trackSerial ? imeis.length : Math.max(0, Number(raw.stock || 0));

    const product = await Product.create({
      ...raw,
      name, barcode,
      business: req.businessId,
      trackSerial,
      supplier: supplier._id,
      stock: trackSerial ? 0 : qty, // synced from units below when trackSerial
      warrantyBrandMonths: Number(raw.warrantyBrandMonths) || 0,
      warrantyShopMonths: Number(raw.warrantyShopMonths) || 0,
      purchasePrice: Number(raw.purchasePrice) || 0,
      sellingPrice: Number(raw.sellingPrice) || 0,
      discountPercent: Number(raw.discountPercent) || 0,
      lowStockAlert: Number(raw.lowStockAlert) || 5,
    });
    createdProducts.push(product);

    if (trackSerial && imeis.length) {
      await PhoneUnit.insertMany(imeis.map((u) => ({
        business: req.businessId, product: product._id, status: 'in_stock',
        imei1: (u.imei1 || '').trim(), imei2: (u.imei2 || '').trim(), serial: (u.serial || '').trim(),
      })));
      product.stock = imeis.length;
      await product.save();
    }

    const unitCost = Number(raw.purchasePrice) || 0;
    total += unitCost * qty;
    purchaseItems.push({ product: product._id, name: product.name, qty, unitCost });
  }

  const paidAmt = Math.max(0, Math.min(Number(paid || 0), total));
  const purchase = await Purchase.create({
    business: req.businessId,
    supplier: supplier._id,
    kind: 'purchase',
    reference, note,
    items: purchaseItems,
    total,
    paid: paidAmt,
    due: Math.max(0, total - paidAmt),
    source: TENDERS.includes(source) ? source : 'cash',
    createdBy: req.user._id,
  });
  supplier.totalPurchase += total;
  supplier.totalPaid += paidAmt;
  await supplier.save();

  await logActivity(req, { action: 'CREATE_PRODUCTS_WITH_SUPPLIER', entity: 'Supplier', entityId: supplier._id, meta: { products: createdProducts.length, total } });
  created(res, { products: createdProducts, supplier, purchase });
});

// @route PUT /api/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  // if a barcode is being set, make sure no other product already owns it
  const barcode = String(req.body.barcode || '').trim();
  if (barcode) {
    const clash = await Product.findOne(tenantFilter(req, { barcode, _id: { $ne: req.params.id } }));
    if (clash) throw new ApiError(409, 'Barcode already in use by another product');
  }
  // an empty string means "no supplier" — cast that to null so Mongoose doesn't
  // try (and fail) to interpret '' as an ObjectId
  const body = { ...req.body };
  if ('supplier' in body && !body.supplier) body.supplier = null;

  const product = await Product.findOneAndUpdate(
    tenantFilter(req, { _id: req.params.id }),
    body,
    { new: true, runValidators: true }
  ).populate('supplier', 'name');
  if (!product) throw new ApiError(404, 'Product not found');
  await logActivity(req, { action: 'UPDATE_PRODUCT', entity: 'Product', entityId: product._id });
  ok(res, { product }, 'Product updated');
});

// @route DELETE /api/products/:id  (soft delete)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndUpdate(
    tenantFilter(req, { _id: req.params.id }),
    { isActive: false },
    { new: true }
  );
  if (!product) throw new ApiError(404, 'Product not found');
  await logActivity(req, { action: 'DELETE_PRODUCT', entity: 'Product', entityId: product._id });
  ok(res, {}, 'Product deleted');
});

// @route POST /api/products/scan-ai  (multipart, field: image)
// Reads a photo of a phone / its box / its IMEI sticker via vision AI and
// suggests a matching existing product (or none). Purely a suggestion — this
// never writes to the database; the owner confirms or corrects before anything
// is saved (either adding the IMEI to the matched product via the existing
// /units endpoint, or opening Add Product pre-filled for a brand-new one).
export const scanProductWithAI = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image provided');

  const settings = await MarketingSettings.findOne({ business: req.businessId });
  const ai = settings?.ai ? { ...settings.ai.toObject(), apiKey: decryptSecret(settings.ai.apiKey) } : null;
  if (!hasVisionAI(ai)) {
    throw new ApiError(400, 'AI photo-scan is not configured. Add a free Gemini key on the server, or your own Anthropic/OpenAI key in Marketing → Integrations & Keys.');
  }

  const mimeType = req.file.mimetype || 'image/jpeg';
  const base64 = req.file.buffer.toString('base64');
  const raw = await generateVision(ai, base64, mimeType, SCAN_PROMPT, 400);
  const extracted = extractScanJson(raw);

  const name = String(extracted.name || '').trim();
  const imei1 = String(extracted.imei1 || '').trim();
  const imei2 = String(extracted.imei2 || '').trim();
  if (!name && !imei1 && !imei2) {
    throw new ApiError(422, "Couldn't identify a product name or IMEI in this photo — try a clearer picture of the label/box");
  }

  // If this IMEI is already in the system, say so plainly rather than
  // suggesting it be added again as if it were new stock.
  if (imei1 || imei2) {
    const codes = [imei1, imei2].filter(Boolean);
    const existingUnit = await PhoneUnit.findOne(tenantFilter(req, {
      $or: [{ imei1: { $in: codes } }, { imei2: { $in: codes } }, { serial: { $in: codes } }],
    })).populate('product', 'name');
    if (existingUnit) {
      throw new ApiError(409, `This IMEI is already in the system, under "${existingUnit.product?.name || 'a product'}" (${existingUnit.status === 'sold' ? 'sold' : 'in stock'}).`);
    }
  }

  let matchedProduct = null;
  if (name) {
    const candidates = await Product.find(tenantFilter(req, { isActive: true }));
    const normName = normalizeName(name);
    matchedProduct = candidates.find((p) => normalizeName(p.name) === normName)
      || candidates.find((p) => { const n = normalizeName(p.name); return n.length > 3 && (n.includes(normName) || normName.includes(n)); })
      || null;
  }

  ok(res, {
    extracted: {
      name, brand: String(extracted.brand || '').trim(), storage: String(extracted.storage || '').trim(),
      color: String(extracted.color || '').trim(), imei1, imei2,
    },
    matchedProduct: matchedProduct ? {
      _id: matchedProduct._id, name: matchedProduct.name, brand: matchedProduct.brand,
      storage: matchedProduct.storage, color: matchedProduct.color, category: matchedProduct.category,
    } : null,
  });
});
