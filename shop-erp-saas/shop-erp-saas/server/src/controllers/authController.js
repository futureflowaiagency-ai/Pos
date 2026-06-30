import mongoose from 'mongoose';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/apiResponse.js';
import { generateToken } from '../utils/generateToken.js';
import { logActivity } from '../middleware/activityLogger.js';
import { sendSystemMail, systemMailReady } from '../services/emailService.js';
import User from '../models/User.js';
import Business from '../models/Business.js';

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

export const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  business: u.business,
  preferences: u.preferences,
});

// @desc Public self-registration is DISABLED.
//       Owner accounts can only be created by a Super Admin (see adminController.createOwner).
// @route POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  throw new ApiError(403, 'Public registration is disabled. Please contact the administrator to create an account.');
});

// Internal helper reused by the admin "create owner" flow.
export const createOwnerWithBusiness = async ({ name, email, password, phone, businessName, businessType }) => {
  if (!name || !email || !password || !businessName)
    throw new ApiError(400, 'name, email, password and businessName are required');

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already registered');

  const session = await mongoose.startSession();
  let user, business;
  try {
    await session.withTransaction(async () => {
      [user] = await User.create([{ name, email, password, phone, role: 'owner' }], { session });
      [business] = await Business.create(
        [{ name: businessName, type: businessType || 'general', owner: user._id, phone }],
        { session }
      );
      user.business = business._id;
      await user.save({ session });
    });
  } finally {
    session.endSession();
  }
  return { user, business };
};

// @desc Login
// @route POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password required');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid credentials');
  if (!user.isActive) throw new ApiError(403, 'Account disabled');

  const token = generateToken({ id: user._id });
  await logActivity({ ...req, user, businessId: user.business?.toString() }, { action: 'LOGIN', entity: 'User', entityId: user._id });
  ok(res, { token, user: publicUser(user) }, 'Login successful');
});

// @desc Get current user
// @route GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const business = req.user.business ? await Business.findById(req.user.business) : null;
  ok(res, { user: publicUser(req.user), business });
});

// @desc Update theme preference
// @route PATCH /api/auth/preferences
export const updatePreferences = asyncHandler(async (req, res) => {
  const { theme } = req.body;
  if (theme) req.user.preferences.theme = theme;
  await req.user.save();
  ok(res, { preferences: req.user.preferences }, 'Preferences updated');
});

// @desc Email a 6-digit code to confirm a password change (logged-in user)
// @route POST /api/auth/password/request-code
export const requestPasswordCode = asyncHandler(async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!email || email !== req.user.email)
    throw new ApiError(400, 'Enter the email address of your own account');
  if (!systemMailReady())
    throw new ApiError(503, 'Email service is not set up on the server. Please contact the administrator.');

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  await User.updateOne(
    { _id: req.user._id },
    { resetCode: hashCode(code), resetCodeExpires: new Date(Date.now() + 10 * 60 * 1000) }
  );

  await sendSystemMail(
    req.user.email,
    'Your password change code',
    `Hi ${req.user.name},\n\nYour verification code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, you can ignore this email.`
  );
  ok(res, {}, 'Verification code sent to your email');
});

// @desc Verify the code and set a new password (logged-in user)
// @route POST /api/auth/password/change
export const changePasswordWithCode = asyncHandler(async (req, res) => {
  const { code, newPassword } = req.body;
  if (!code || !newPassword) throw new ApiError(400, 'Code and new password are required');
  if (String(newPassword).length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

  const user = await User.findById(req.user._id).select('+password +resetCode +resetCodeExpires');
  if (!user.resetCode || !user.resetCodeExpires || user.resetCodeExpires.getTime() < Date.now())
    throw new ApiError(400, 'No active code. Please request a new one.');
  if (user.resetCode !== hashCode(String(code).trim()))
    throw new ApiError(400, 'Invalid verification code');

  user.password = newPassword; // hashed by the pre-save hook
  user.resetCode = undefined;
  user.resetCodeExpires = undefined;
  await user.save();

  await logActivity(req, { action: 'CHANGE_PASSWORD', entity: 'User', entityId: user._id });
  ok(res, {}, 'Password changed successfully');
});
