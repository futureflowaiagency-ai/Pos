import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

// Keep the file in memory; we stream it straight to Cloudinary (no disk writes).
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new ApiError(400, 'Only image files are allowed'));
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
}).single('image');
