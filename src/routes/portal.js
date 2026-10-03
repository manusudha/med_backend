/** Patient self-service portal — only the signed-in patient's own data. */
const router = require('express').Router();
const { Patient, Appointment, Prescription } = require('../models');
const { asyncHandler, HttpError } = require('../utils/http');
const { validate, z, ymd, reqText, text } = require('../middleware/validate');
const { todayYmd, addDays } = require('../utils/dates');

async function me(req) {
  const p = await Patient.findOne({ _id: req.user.patientId, clinicId: req.clinicId }).lean();
  if (!p) throw new HttpError(404, 'Your patient record was not found. Please contact the clinic.');
  return p;
}

// GET /api/portal/profile
router.get('/profile', asyncHandler(async (req, res) => res.json(await me(req))));

// GET /api/portal/appointments
router.get('/appointments', asyncHandler(async (req, res) => {
  const p = await me(req);
  const items = await Appointment.find({ clinicId: req.clinicId, patientId: p._id })
    .sort({ date: -1, time: -1 }).limit(200).lean();
  res.json({ items, today: todayYmd(req.clinic.timezone) });
}));

// POST /api/portal/appointments — patient requests a visit (clinic confirms it)
router.post('/appointments', validate(z.object({
  date: ymd,
  therapy: reqText('Therapy', 80),
  concern: text(300).optional().default(''),
})), asyncHandler(async (req, res) => {
  const p = await me(req);
  const t = todayYmd(req.clinic.timezone);
  if (req.body.date < t) throw new HttpError(400, 'Pick today or a future date.');
  if (req.body.date > addDays(t, 180)) throw new HttpError(400, 'You can book up to 6 months ahead.');
  const pending = await Appointment.countDocuments({
    clinicId: req.clinicId, patientId: p._id, status: 'pending', date: { $gte: t },
  });
  if (pending >= 3) throw new HttpError(429, 'You already have 3 requests waiting. The clinic will confirm them soon.');

  const appt = await Appointment.create({
    ...req.body,
    clinicId: req.clinicId,
    patientId: p._id,
    patientCode: p.patientCode,
    patientName: p.name,
    patientAge: p.age,
    status: 'pending',
    source: 'patient',
    createdBy: req.user._id,
  });
  res.status(201).json(appt);
}));

// GET /api/portal/prescriptions
router.get('/prescriptions', asyncHandler(async (req, res) => {
  const p = await me(req);
  const items = await Prescription.find({ clinicId: req.clinicId, patientId: p._id })
    .sort({ active: -1, prescribedDate: -1 }).limit(200).lean();
  res.json({ items });
}));

module.exports = router;
