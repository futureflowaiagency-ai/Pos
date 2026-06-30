import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

// Allowed logical folders so clients can't write anywhere they like.
const FOLDERS = {
  logo: 'shop-erp/logos',
  employee: 'shop-erp/employees',
  product: 'shop-erp/products',
  misc: 'shop-erp/misc',
};

// @route POST /api/upload  (multipart/form-data, field: image, optional field: type)
export const uploadFile = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) throw new ApiError(500, 'Image upload is not configured');
  if (!req.file) throw new ApiError(400, 'No image file provided');

  const folder = FOLDERS[req.body.type] || FOLDERS.misc;
  // Scope assets per tenant so a business can be cleaned up independently.
  const fullFolder = req.businessId ? `${folder}/${req.businessId}` : folder;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: fullFolder, resource_type: 'image' },
      (error, uploaded) => (error ? reject(error) : resolve(uploaded))
    );
    stream.end(req.file.buffer);
  });

  ok(res, { url: result.secure_url, publicId: result.public_id }, 'Image uploaded');
});
