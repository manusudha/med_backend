const router = require('express').Router();
const { Prescription, Patient } = require('../models');
const { asyncHandler, HttpError } = require('../utils/http');
const { validate, validId, z, ymd, objectId, text, reqText } = require('../middleware/validate');
const { requireAccess } = require('../middleware/auth');
const { todayYmd } = require('../utils/dates');

// POST /api/prescriptions
router.post('/', requireAccess('prescriptions', 'edit'), validate(z.object({
  patientId: objectId,
  medicine: reqText('Medicine', 120),
  dosage: text(200).optional().default(''),
  duration: text(60).optional().default(''),
  purpose: text(200).optional().default(''),
  prescribedDate: ymd.optional(),
})), asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.body.patientId, clinicId: req.clinicId }).lean();
  if (!patient) throw new HttpError(400, 'Patient not found.');
  const rx = await Prescription.create({
    ...req.body,
    prescribedDate: req.body.prescribedDate || todayYmd(req.clinic.timezone),
    clinicId: req.clinicId,
    prescribedBy: req.user._id,
    prescribedByName: req.user.name,
  });
  res.status(201).json(rx);
}));

// PATCH /api/prescriptions/:id — e.g. { active: false } to stop a medicine
router.patch('/:id', validId('id'), requireAccess('prescriptions', 'edit'), validate(z.object({
  active: z.boolean().optional(),
  dosage: text(200).optional(),
  duration: text(60).optional(),
  purpose: text(200).optional(),
})), asyncHandler(async (req, res) => {
  const set = { ...req.body };
  Object.keys(set).forEach((k) => set[k] === undefined && delete set[k]);
  const rx = await Prescription.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { $set: set }, { new: true });
  if (!rx) throw new HttpError(404, 'Prescription not found.');
  res.json(rx);
}));

module.exports = router;
