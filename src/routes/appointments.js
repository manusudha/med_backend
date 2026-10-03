const router = require('express').Router();
const { Appointment, Patient, User } = require('../models');
const { asyncHandler, HttpError, escapeRegex, paging, qstr } = require('../utils/http');
const { validate, validId, z, ymd, hhmm, objectId, text, reqText } = require('../middleware/validate');
const { requireAccess } = require('../middleware/auth');
const { todayYmd, addDays, weekStart } = require('../utils/dates');
const { APPOINTMENT_STATUSES } = require('../constants');

const today = (req) => todayYmd(req.clinic.timezone);

async function markVisit(clinicId, appt) {
  if (appt.status !== 'done') return;
  await Patient.updateOne(
    { _id: appt.patientId, clinicId },
    { $set: { lastTherapy: appt.therapy, lastVisitDate: appt.date } },
  );
}

async function resolveDoctor(req, doctorId) {
  if (doctorId) {
    const doc = await User.findOne({ _id: doctorId, clinicId: req.clinicId, status: 'active' }).lean();
    if (!doc) throw new HttpError(400, 'Selected doctor was not found.');
    return { doctorId: doc._id, doctorName: doc.name };
  }
  if (req.user.roleKey === 'doctor') return { doctorId: req.user._id, doctorName: req.user.name };
  return { doctorId: null, doctorName: '' };
}

// GET /api/appointments?scope=today|upcoming|past&q=&status=&page=&limit=
router.get('/', requireAccess('appointments'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 50, 200);
  const t = today(req);
  const scope = qstr(req.query.scope) || 'today';
  const filter = { clinicId: req.clinicId };
  let sort = { date: 1, time: 1 };

  if (scope === 'today') filter.date = t;
  else if (scope === 'upcoming') filter.date = { $gt: t };
  else if (scope === 'past') { filter.date = { $lt: t }; sort = { date: -1, time: -1 }; }
  else if (scope === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(qstr(req.query.date))) filter.date = qstr(req.query.date);

  const status = qstr(req.query.status);
  if (APPOINTMENT_STATUSES.includes(status)) filter.status = status;
  const q = qstr(req.query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ patientName: rx }, { patientCode: rx }, { therapy: rx }];
  }

  const [items, total] = await Promise.all([
    Appointment.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Appointment.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, today: t });
}));

// GET /api/appointments/stats
router.get('/stats', requireAccess('appointments'), asyncHandler(async (req, res) => {
  const t = today(req);
  const c = (f) => Appointment.countDocuments({ clinicId: req.clinicId, status: { $ne: 'cancelled' }, ...f });
  const [todayCount, yesterdayCount, weekCount, pendingToday, upcomingRequests, totalPatients] = await Promise.all([
    c({ date: t }),
    c({ date: addDays(t, -1) }),
    c({ date: { $gte: weekStart(t), $lte: t } }),
    c({ date: t, status: 'pending' }),
    c({ date: { $gte: t }, status: 'pending', source: 'patient' }),
    Patient.countDocuments({ clinicId: req.clinicId }),
  ]);
  res.json({ today: todayCount, yesterday: yesterdayCount, week: weekCount, pendingToday, upcomingRequests, totalPatients });
}));

const createSchema = z.object({
  patientId: objectId,
  date: ymd,
  time: hhmm.or(z.literal('')).optional().default(''),
  therapy: reqText('Therapy', 80),
  doctorId: objectId.optional().or(z.literal('')).transform((v) => v || undefined),
  concern: text(300).optional().default(''),
  notes: text(2000).optional().default(''),
  status: z.enum(APPOINTMENT_STATUSES).optional().default('confirmed'),
});

// POST /api/appointments
router.post('/', requireAccess('appointments', 'edit'), validate(createSchema), asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.body.patientId, clinicId: req.clinicId }).lean();
  if (!patient) throw new HttpError(400, 'Patient not found.');
  if (patient.status !== 'active') throw new HttpError(400, 'This patient account is inactive.');

  const appt = await Appointment.create({
    ...req.body,
    ...(await resolveDoctor(req, req.body.doctorId)),
    clinicId: req.clinicId,
    patientCode: patient.patientCode,
    patientName: patient.name,
    patientAge: patient.age,
    source: 'clinic',
    createdBy: req.user._id,
  });
  await markVisit(req.clinicId, appt);
  res.status(201).json(appt);
}));

// PATCH /api/appointments/:id — change status, reschedule, add notes
router.patch('/:id', validId('id'), requireAccess('appointments', 'edit'), validate(z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  date: ymd.optional(),
  time: hhmm.or(z.literal('')).optional(),
  therapy: reqText('Therapy', 80).optional(),
  notes: text(2000).optional(),
  doctorId: objectId.optional(),
})), asyncHandler(async (req, res) => {
  const set = { ...req.body };
  Object.keys(set).forEach((k) => set[k] === undefined && delete set[k]);
  if (set.doctorId) Object.assign(set, await resolveDoctor(req, set.doctorId));

  const appt = await Appointment.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId }, { $set: set }, { new: true, runValidators: true },
  );
  if (!appt) throw new HttpError(404, 'Appointment not found.');
  await markVisit(req.clinicId, appt);
  res.json(appt);
}));

module.exports = router;
