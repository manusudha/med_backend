const router = require('express').Router();
const { Admission, Patient, DailySheet } = require('../models');
const { asyncHandler, HttpError, qstr } = require('../utils/http');
const { validate, validId, z, ymd, objectId, text, reqText } = require('../middleware/validate');
const { requireAccess } = require('../middleware/auth');
const { todayYmd, addDays, diffDays } = require('../utils/dates');

const today = (req) => todayYmd(req.clinic.timezone);

/** Day number of `date` inside an admission (day 1 = admit date). */
const dayOf = (adm, date) => diffDays(adm.admitDate, date) + 1;

/** How many day tiles to show for an admission. */
function totalDays(adm, t) {
  const end = adm.status === 'discharged' && adm.dischargeDate ? adm.dischargeDate : t;
  return Math.min(365, Math.max(adm.plannedDays, dayOf(adm, end)));
}

async function loadAdmission(req) {
  const adm = await Admission.findOne({ _id: req.params.id, clinicId: req.clinicId }).lean();
  if (!adm) throw new HttpError(404, 'Admission not found.');
  return adm;
}

// GET /api/admissions?status=admitted|discharged
router.get('/', requireAccess('sheets'), asyncHandler(async (req, res) => {
  const status = qstr(req.query.status) === 'discharged' ? 'discharged' : 'admitted';
  const t = today(req);
  const items = await Admission.find({ clinicId: req.clinicId, status })
    .sort({ admitDate: -1 }).limit(status === 'admitted' ? 500 : 100).lean();
  res.json({
    items: items.map((a) => ({ ...a, currentDay: Math.max(0, Math.min(dayOf(a, a.dischargeDate || t), totalDays(a, t))) })),
    today: t,
  });
}));

// POST /api/admissions — admit a patient
router.post('/', requireAccess('sheets', 'edit'), validate(z.object({
  patientId: objectId,
  therapy: reqText('Therapy course', 80),
  concern: text(300).optional(),
  admitDate: ymd,
  plannedDays: z.coerce.number().int().min(1, 'At least 1 day').max(365),
})), asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.body.patientId, clinicId: req.clinicId }).lean();
  if (!patient) throw new HttpError(400, 'Patient not found.');
  const already = await Admission.findOne({ clinicId: req.clinicId, patientId: patient._id, status: 'admitted' }).lean();
  if (already) throw new HttpError(409, `${patient.name} is already admitted.`);

  const adm = await Admission.create({
    ...req.body,
    concern: req.body.concern || patient.primaryConcern,
    clinicId: req.clinicId,
    patientCode: patient.patientCode,
    patientName: patient.name,
    patientAge: patient.age,
    patientGender: patient.gender,
    admittedBy: req.user._id,
  });
  res.status(201).json(adm);
}));

// GET /api/admissions/:id — admission + day tiles
router.get('/:id', validId('id'), requireAccess('sheets'), asyncHandler(async (req, res) => {
  const adm = await loadAdmission(req);
  const t = today(req);
  const filled = await DailySheet.find({ clinicId: req.clinicId, admissionId: adm._id }).select('dayNumber').lean();
  const filledSet = new Set(filled.map((s) => s.dayNumber));
  const days = Array.from({ length: totalDays(adm, t) }, (_, i) => {
    const date = addDays(adm.admitDate, i);
    return { dayNumber: i + 1, date, filled: filledSet.has(i + 1), isToday: date === t, isFuture: date > t };
  });
  res.json({ admission: adm, days, today: t });
}));

// PATCH /api/admissions/:id — change plan
router.patch('/:id', validId('id'), requireAccess('sheets', 'edit'), validate(z.object({
  therapy: reqText('Therapy course', 80).optional(),
  concern: text(300).optional(),
  plannedDays: z.coerce.number().int().min(1).max(365).optional(),
})), asyncHandler(async (req, res) => {
  const set = { ...req.body };
  Object.keys(set).forEach((k) => set[k] === undefined && delete set[k]);
  const adm = await Admission.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { $set: set }, { new: true });
  if (!adm) throw new HttpError(404, 'Admission not found.');
  res.json(adm);
}));

// POST /api/admissions/:id/discharge
router.post('/:id/discharge', validId('id'), requireAccess('sheets', 'edit'), asyncHandler(async (req, res) => {
  const adm = await Admission.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId, status: 'admitted' },
    { $set: { status: 'discharged', dischargeDate: today(req) } },
    { new: true },
  );
  if (!adm) throw new HttpError(404, 'Admission not found or already discharged.');
  res.json(adm);
}));

const dayParam = (req) => {
  const n = parseInt(req.params.day, 10);
  if (!Number.isInteger(n) || n < 1 || n > 365) throw new HttpError(404, 'Day not found.');
  return n;
};

// GET /api/admissions/:id/days/:day
router.get('/:id/days/:day', validId('id'), requireAccess('sheets'), asyncHandler(async (req, res) => {
  const adm = await loadAdmission(req);
  const dayNumber = dayParam(req);
  const sheet = await DailySheet.findOne({ clinicId: req.clinicId, admissionId: adm._id, dayNumber }).lean();
  res.json({ admission: adm, dayNumber, date: addDays(adm.admitDate, dayNumber - 1), sheet, today: today(req) });
}));

const s = text(500).optional().default('');
const long = text(3000).optional().default('');
const compliance = z.enum(['', 'yes', 'partial', 'no']).optional().default('');

// PUT /api/admissions/:id/days/:day — create or update that day's sheet
router.put('/:id/days/:day', validId('id'), requireAccess('sheets', 'edit'), validate(z.object({
  vitals: z.object({ bp: s, pulse: s, temperature: s, weight: s, spo2: s, painLevel: s }).optional().default({}),
  timetable: z.object({
    wakeUp: s, morningMedication: s, breakfast: s, morningTherapy: s, preLunchMedication: s, lunch: s,
    afternoonRest: s, eveningSnack: s, eveningTherapy: s, dinner: s, nightMedication: s, sleepNotes: s,
  }).optional().default({}),
  medicineCompliance: compliance,
  medicineNotes: long,
  dietCompliance: compliance,
  dietNotes: long,
  condition: z.enum(['', 'improving', 'stable', 'attention']).optional().default(''),
  doctorNotes: long,
  staffNotes: long,
})), asyncHandler(async (req, res) => {
  const adm = await loadAdmission(req);
  const dayNumber = dayParam(req);
  const date = addDays(adm.admitDate, dayNumber - 1);
  if (date > today(req)) throw new HttpError(400, "This day hasn't started yet. You can fill it on the day.");

  const sheet = await DailySheet.findOneAndUpdate(
    { clinicId: req.clinicId, admissionId: adm._id, dayNumber },
    {
      $set: { ...req.body, date, patientId: adm.patientId, filledBy: req.user._id, filledByName: req.user.name },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.json(sheet);
}));

module.exports = router;
