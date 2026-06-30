import fs from 'fs/promises';
import path from 'path';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import { UPLOADS_DIR } from '../config/uploads.js';

// Allowed logical folders so clients can't write anywhere they like.
const FOLDERS = {
  logo: 'logos',
  employee: 'employees',
  product: 'products',
  misc: 'misc',
};

// @route POST /api/upload  (multipart/form-data, field: image, optional field: type)
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file provided');
  const folder = FOLDERS[req.body.type] || FOLDERS.misc;

  // Prefer Cloudinary when configured; otherwise fall back to local disk storage
  // so image upload works out-of-the-box without any external account.
  if (isCloudinaryConfigured()) {
    const base = `shop-erp/${folder}`;
    const fullFolder = req.businessId ? `${base}/${req.businessId}` : base;
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: fullFolder, resource_type: 'image' },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      );
      stream.end(req.file.buffer);
    });
    return ok(res, { url: result.secure_url, publicId: result.public_id }, 'Image uploaded');
  }

  // ---- local disk fallback (served statically at /api/uploads) ----
  const tenant = req.businessId || 'shared';
  const dir = path.join(UPLOADS_DIR, folder, tenant);
  await fs.mkdir(dir, { recursive: true });

  let ext = (path.extname(req.file.originalname || '') || '.jpg').toLowerCase();
  if (!/^\.[a-z0-9]+$/.test(ext)) ext = '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  await fs.writeFile(path.join(dir, filename), req.file.buffer);

  // Always forward slashes in the URL (same-origin; nginx already proxies /api).
  const url = `/api/uploads/${folder}/${tenant}/${filename}`;
  ok(res, { url }, 'Image uploaded');
});
