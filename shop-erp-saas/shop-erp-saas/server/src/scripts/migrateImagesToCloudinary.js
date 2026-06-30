/**
 * One-time migration: move existing base64 data-URL images from MongoDB
 * to Cloudinary, replacing each field with the resulting secure URL.
 *
 * Covers: Business.logoUrl, Employee.photo, Product.imageUrl.
 * Safe to re-run — only fields still starting with "data:" are touched.
 *
 * Run from the server folder:  node src/scripts/migrateImagesToCloudinary.js
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import Business from '../models/Business.js';
import Employee from '../models/Employee.js';
import Product from '../models/Product.js';

const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:');

const uploadDataUrl = (dataUrl, folder) =>
  cloudinary.uploader.upload(dataUrl, { folder, resource_type: 'image' });

// Migrate one collection: `field` holds the image, scoped into a tenant folder.
async function migrateModel(Model, label, field, baseFolder, tenantOf) {
  const filter = { [field]: { $regex: '^data:' } };
  const docs = await Model.find(filter).select(`_id ${field} ${tenantOf}`).lean();
  console.log(`\n${label}: ${docs.length} document(s) with embedded images`);

  let done = 0, failed = 0;
  for (const doc of docs) {
    const tenant = doc[tenantOf]?.toString();
    const folder = tenant ? `${baseFolder}/${tenant}` : baseFolder;
    try {
      const res = await uploadDataUrl(doc[field], folder);
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
  console.log('🚚 Migrating embedded base64 images to Cloudinary...');

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
