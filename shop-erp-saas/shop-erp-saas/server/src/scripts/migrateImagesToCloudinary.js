/**
 * One-time migration: move existing images to Cloudinary and replace each field
 * with the resulting secure URL. Handles BOTH:
 *   - base64 data-URLs embedded in MongoDB (older versions)
 *   - locally-stored files served at /api/uploads/... (disk fallback)
 *
 * Covers: Business.logoUrl, Employee.photo, Product.imageUrl.
 * Safe to re-run — only fields still pointing at data:/local uploads are touched.
 *
 * Run from the server folder:  node src/scripts/migrateImagesToCloudinary.js
 */
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import { UPLOADS_DIR } from '../config/uploads.js';
import Business from '../models/Business.js';
import Employee from '../models/Employee.js';
import Product from '../models/Product.js';

const LOCAL_PREFIX = '/api/uploads/';

// Upload either a base64 data-URL or a local /api/uploads file to Cloudinary.
const uploadValue = (val, folder) => {
  if (val.startsWith('data:')) {
    return cloudinary.uploader.upload(val, { folder, resource_type: 'image' });
  }
  if (val.startsWith(LOCAL_PREFIX)) {
    const filePath = path.join(UPLOADS_DIR, val.slice(LOCAL_PREFIX.length));
    return cloudinary.uploader.upload(filePath, { folder, resource_type: 'image' });
  }
  throw new Error(`Unsupported image value: ${val.slice(0, 40)}…`);
};

// Migrate one collection: `field` holds the image, scoped into a tenant folder.
async function migrateModel(Model, label, field, baseFolder, tenantOf) {
  const filter = { [field]: { $regex: `^(data:|${LOCAL_PREFIX})` } };
  const docs = await Model.find(filter).select(`_id ${field} ${tenantOf}`).lean();
  console.log(`\n${label}: ${docs.length} document(s) to migrate`);

  let done = 0, failed = 0;
  for (const doc of docs) {
    const tenant = doc[tenantOf]?.toString();
    const folder = tenant ? `${baseFolder}/${tenant}` : baseFolder;
    try {
      const res = await uploadValue(doc[field], folder);
      await Model.updateOne({ _id: doc._id }, { $set: { [field]: res.secure_url } });
      done++;
      console.log(`  ✓ ${doc._id} -> ${res.secure_url}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${doc._id}: ${err.message}`);
    }
  }
  console.log(`${label}: migrated ${done}, failed ${failed}`);
  return { done, failed };
}

const run = async () => {
  if (!isCloudinaryConfigured()) {
    console.error('❌ Cloudinary is not configured. Set CLOUDINARY_* in server/.env first.');
    process.exit(1);
  }
  await connectDB();
  console.log('🚚 Migrating images (base64 + local uploads) to Cloudinary...');

  const results = [];
  results.push(await migrateModel(Business, 'Business logos', 'logoUrl', 'shop-erp/logos', '_id'));
  results.push(await migrateModel(Employee, 'Employee photos', 'photo', 'shop-erp/employees', 'business'));
  results.push(await migrateModel(Product, 'Product images', 'imageUrl', 'shop-erp/products', 'business'));

  const total = results.reduce((a, r) => ({ done: a.done + r.done, failed: a.failed + r.failed }), { done: 0, failed: 0 });
  console.log(`\n✅ Done. Total migrated: ${total.done}, failed: ${total.failed}`);
  await mongoose.disconnect();
  process.exit(total.failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Migration crashed:', err);
  process.exit(1);
});
