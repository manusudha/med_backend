const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { Clinic, User, Role } = require('../models');
const { asyncHandler, HttpError, escapeRegex } = require('../utils/http');
const { validate, z, reqText } = require('../middleware/validate');
const { authenticate, signToken } = require('../middleware/auth');
const { checkPassword, hashPassword } = require('../utils/security');
const { sessionPayload } = require('../services/session');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

// Used to keep response time the same whether or not the user exists
const DUMMY_HASH = require('bcryptjs').hashSync('not-a-real-password', 10);
const BAD_LOGIN = 'Incorrect clinic code, user ID or password.';

const loginSchema = z.object({
  clinicCode: reqText('Clinic code', 30).toLowerCase(),
  loginId: reqText('User ID', 40),
  password: reqText('Password', 200),
});

// POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { clinicCode, loginId, password } = req.body;

  const clinic = await Clinic.findOne({ code: clinicCode });
  const user = clinic
    ? await User.findOne({ clinicId: clinic._id, loginId: new RegExp(`^${escapeRegex(loginId)}$`, 'i') }).select('+passwordHash')
    : null;

  const ok = await checkPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!clinic || !user || !ok) throw new HttpError(401, BAD_LOGIN);
  if (clinic.status !== 'active') throw new HttpError(403, 'This clinic account is suspended. Please contact support.');
  if (user.status !== 'active') throw new HttpError(403, 'Your account is disabled. Please contact your clinic admin.');

  const role = await Role.findOne({ clinicId: clinic._id, key: user.roleKey }).lean();
  if (!role) throw new HttpError(403, 'Your role no longer exists. Please contact your clinic admin.');

  await User.updateOne({ _id: user._id, clinicId: clinic._id }, { $set: { lastLoginAt: new Date() } });
  res.json({ token: signToken(user), ...sessionPayload(user.toObject(), role, clinic) });
}));

// GET /api/auth/me — refresh session info (called when the app opens)
router.get('/me', authenticate, (req, res) => {
  res.json(sessionPayload(req.user, req.role, req.clinic));
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, validate(z.object({
  currentPassword: reqText('Current password'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
})), asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.user._id, clinicId: req.clinicId }).select('+passwordHash');
  if (!(await checkPassword(req.body.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }
  user.passwordHash = await hashPassword(req.body.newPassword);
  user.tokenVersion += 1; // log out other devices
  await user.save();
  res.json({ message: 'Password changed.', token: signToken(user) });
}));

module.exports = router;
