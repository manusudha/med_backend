/**
 * SaaS owner API (you, not your clinics). Protected by the x-platform-key header.
 * Use it to onboard a new client clinic, list clinics, or suspend one.
 */
const router = require('express').Router();
const env = require('../config/env');
const { Clinic, User, Patient } = require('../models');
const { asyncHandler, HttpError } = require('../utils/http');
const { validate, validId, z, reqText, text } = require('../middleware/validate');
const { safeEqual } = require('../utils/security');
const { createClinic } = require('../services/clinicSetup');

router.use((req, res, next) => {
  if (!env.PLATFORM_ADMIN_KEY || env.PLATFORM_ADMIN_KEY.length < 24) {
    return next(new HttpError(404, 'Not found.'));
  }
  const key = req.headers['x-platform-key'] || '';
  return safeEqual(key, env.PLATFORM_ADMIN_KEY) ? next() : next(new HttpError(401, 'Invalid platform key.'));
});

// POST /api/platform/clinics
router.post('/clinics', validate(z.object({
  name: reqText('Clinic name', 120),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,30}$/, 'Code: 3–30 lowercase letters, numbers or dashes'),
  subtitle: text(120).optional(),
  timezone: z.string().optional(),
  plan: z.enum(['trial', 'basic', 'pro']).optional(),
  admin: z.object({
    name: text(100).optional(),
    loginId: z.string().trim().min(3).max(40).optional(),
    password: z.string().min(8, 'Admin password must be at least 8 characters'),
  }),
})), asyncHandler(async (req, res) => {
  if (await Clinic.exists({ code: req.body.code })) throw new HttpError(409, 'That clinic code is already taken.');
  const { clinic, adminUser } = await createClinic(req.body);
  res.status(201).json({ clinic: clinic.toPublic(), admin: { loginId: adminUser.loginId } });
}));

// GET /api/platform/clinics
router.get('/clinics', asyncHandler(async (req, res) => {
  const clinics = await Clinic.find().sort({ createdAt: -1 }).lean();
  const items = await Promise.all(clinics.map(async (c) => ({
    ...c,
    users: await User.countDocuments({ clinicId: c._id, roleKey: { $ne: 'patient' } }),
    patients: await Patient.countDocuments({ clinicId: c._id }),
  })));
  res.json({ items });
}));

// PATCH /api/platform/clinics/:id — { status: 'suspended' | 'active', plan }
router.patch('/clinics/:id', validId('id'), validate(z.object({
  status: z.enum(['active', 'suspended']).optional(),
  plan: z.enum(['trial', 'basic', 'pro']).optional(),
})), asyncHandler(async (req, res) => {
  const clinic = await Clinic.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!clinic) throw new HttpError(404, 'Clinic not found.');
  res.json(clinic.toPublic());
}));

module.exports = router;
