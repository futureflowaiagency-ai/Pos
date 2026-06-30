import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe, updatePreferences, requestPasswordCode, changePasswordWithCode } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Stricter limiter for credential endpoints to slow down brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);
router.patch('/preferences', protect, updatePreferences);
router.post('/password/request-code', protect, authLimiter, requestPasswordCode);
router.post('/password/change', protect, authLimiter, changePasswordWithCode);
export default router;
