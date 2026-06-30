import { Router } from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadFile } from '../controllers/uploadController.js';

const router = Router();

// Turn multer's own errors (e.g. file too large) into clean 400 responses.
const handleUpload = (req, res, next) =>
  uploadImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 3MB)' : err.message;
      return res.status(400).json({ success: false, message });
    }
    if (err) return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    next();
  });

router.post('/', protect, requireBusiness, handleUpload, uploadFile);

export default router;
