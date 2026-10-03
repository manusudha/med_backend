const router = require('express').Router();
const { Clinic } = require('../models');
const { asyncHandler } = require('../utils/http');
const { validate, z, text, reqText } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');

const list = z.array(z.string().trim().min(1).max(80)).max(100);

// GET /api/clinic — current clinic profile & settings
router.get('/', asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.clinicId);
  res.json(clinic.toPublic());
}));

// PATCH /api/clinic — admin updates clinic profile/settings
router.patch('/', requireAdmin, validate(z.object({
  name: reqText('Clinic name', 120).optional(),
  subtitle: text(120).optional(),
  phone: text(20).optional(),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  address: text(200).optional(),
  therapies: list.optional(),
  stockCategories: list.optional(),
  stockUnits: list.optional(),
})), asyncHandler(async (req, res) => {
  const { therapies, stockCategories, stockUnits, ...profile } = req.body;
  const set = { ...profile };
  if (therapies) set['settings.therapies'] = [...new Set(therapies)];
  if (stockCategories) set['settings.stockCategories'] = [...new Set(stockCategories)];
  if (stockUnits) set['settings.stockUnits'] = [...new Set(stockUnits)];
  const clinic = await Clinic.findByIdAndUpdate(req.clinicId, { $set: set }, { new: true, runValidators: true });
  res.json(clinic.toPublic());
}));

module.exports = router;
