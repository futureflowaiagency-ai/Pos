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

// Generic data-file upload (Smart Stock Import) — no mimetype filter since
// browsers report all sorts of things for .xls/.csv/.txt (and this shop's old
// software exports HTML content with a .xls extension), so the real format is
// sniffed server-side from the content instead.
export const uploadDataFile = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — matches the raised JSON body limit
}).single('file');
