import { Router } from 'express';
import multer from 'multer';
import { getProducts, getProductByBarcode, createProduct, createProductsWithSupplier, updateProduct, deleteProduct, scanProductWithAI } from '../controllers/productController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { requireModule } from '../middleware/permissions.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();
router.use(protect, requireBusiness, requireModule('products'));

// Turn multer's own errors (e.g. file too large) into clean 400 responses.
const handleImageUpload = (req, res, next) =>
  uploadImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 3MB)' : err.message;
      return res.status(400).json({ success: false, message });
    }
    if (err) return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    next();
  });

router.route('/').get(getProducts).post(createProduct);
router.post('/batch-with-supplier', createProductsWithSupplier);
router.post('/scan-ai', handleImageUpload, scanProductWithAI);
router.get('/barcode/:code', getProductByBarcode);
router.route('/:id').put(updateProduct).delete(deleteProduct);
export default router;
