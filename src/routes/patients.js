const router = require('express').Router();
const { Patient, User, Appointment, Prescription, DailySheet, nextSequence } = require('../models');
const { asyncHandler, HttpError, escapeRegex, paging, qstr } = require('../utils/http');
const { validate, validId, z, text, reqText } = require('../middleware/validate');
const { requireAccess, requireAny } = require('../middleware/auth');
const { hashPassword, generatePassword } = require('../utils/security');
const { GENDERS, BLOOD_GROUPS } = require('../constants');

const canView = requireAny([['patients'], ['users'], ['appointments'], ['sheets'], ['prescriptions'], ['addPatient']]);
const canEdit = requireAny([['patients', 'edit'], ['users', 'edit']]);

const patientFields = {
  name: reqText('Full name', 100),
  phone: reqText('Phone number', 20).regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid phone number'),
  age: z.coerce.number({ invalid_type_error: 'Age is required' }).int('Age must be a whole number').min(0).max(130),
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Select a gender' }) }),
  bloodGroup: z.enum(BLOOD_GROUPS).optional().default(''),
  address: text(200).optional().default(''),
  primaryConcern: reqText('Primary health concern', 300),
  allergies: text(300).optional().transform((v) => v || 'None'),
  initialTherapy: text(80).optional().default(''),
};

// GET /api/patients?q=&status=&page=&limit=
router.get('/', canView, asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = { clinicId: req.clinicId };
  const q = qstr(req.query.q);
  const status = qstr(req.query.status);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { patientCode: rx }];
  }
  if (['active', 'inactive'].includes(status)) filter.status = status;

  const [items, total] = await Promise.all([
    Patient.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
}));

// POST /api/patients — register + create the patient's portal login
router.post('/', requireAccess('addPatient', 'edit'), validate(z.object(patientFields)), asyncHandler(async (req, res) => {
  const seq = await nextSequence(req.clinicId, 'patient');
  const patientCode = `PT-${1000 + seq}`;
  const tempPassword = generatePassword();

  const patient = await Patient.create({
    ...req.body,
    clinicId: req.clinicId,
    patientCode,
    lastTherapy: req.body.initialTherapy,
    registeredBy: req.user._id,
  });
  try {
    const user = await User.create({
      clinicId: req.clinicId,
      loginId: patientCode,
      passwordHash: await hashPassword(tempPassword),
      name: patient.name,
      designation: 'Patient',
      roleKey: 'patient',
      patientId: patient._id,
    });
    patient.userId = user._id;
    await patient.save();
  } catch (err) {
    await Patient.deleteOne({ _id: patient._id, clinicId: req.clinicId });
    throw err;
  }
  res.status(201).json({ patient, login: { loginId: patientCode, tempPassword } });
}));

async function loadPatient(req) {
  const p = await Patient.findOne({ _id: req.params.id, clinicId: req.clinicId }).lean();
  if (!p) throw new HttpError(404, 'Patient not found.');
  return p;
}

// GET /api/patients/:id
router.get('/:id', validId('id'), canView, asyncHandler(async (req, res) => {
  const patient = await loadPatient(req);
  const visitCount = await Appointment.countDocuments({ clinicId: req.clinicId, patientId: patient._id, status: 'done' });
  res.json({ ...patient, visitCount });
}));

// PATCH /api/patients/:id
router.patch('/:id', validId('id'), canEdit, validate(z.object({
  ...Object.fromEntries(Object.entries(patientFields).map(([k, v]) => [k, v.optional()])),
  status: z.enum(['active', 'inactive']).optional(),
})), asyncHandler(async (req, res) => {
  const body = { ...req.body };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
  const patient = await Patient.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId }, { $set: body }, { new: true, runValidators: true },
  );
  if (!patient) throw new HttpError(404, 'Patient not found.');

  // Keep the portal login in sync
  if (patient.userId && (body.status || body.name)) {
    const set = {};
    if (body.name) set.name = body.name;
    if (body.status) set.status = body.status;
    const inc = body.status === 'inactive' ? { tokenVersion: 1 } : {};
    await User.updateOne({ _id: patient.userId, clinicId: req.clinicId }, { $set: set, $inc: inc });
  }
  res.json(patient);
}));

// GET /api/patients/:id/visits
router.get('/:id/visits', validId('id'), canView, asyncHandler(async (req, res) => {
  const items = await Appointment.find({ clinicId: req.clinicId, patientId: req.params.id, status: { $ne: 'cancelled' } })
    .sort({ date: -1, time: -1 }).limit(100).lean();
  res.json({ items });
}));

// GET /api/patients/:id/prescriptions
router.get('/:id/prescriptions', validId('id'), canView, asyncHandler(async (req, res) => {
  const items = await Prescription.find({ clinicId: req.clinicId, patientId: req.params.id })
    .sort({ active: -1, prescribedDate: -1 }).limit(200).lean();
  res.json({ items });
}));

// GET /api/patients/:id/sheets — latest daily sheet entries
router.get('/:id/sheets', validId('id'), canView, asyncHandler(async (req, res) => {
  const items = await DailySheet.find({ clinicId: req.clinicId, patientId: req.params.id })
    .sort({ date: -1 }).limit(10).lean();
  res.json({ items });
}));

// POST /api/patients/:id/reset-password — new temporary portal password
router.post('/:id/reset-password', validId('id'), requireAccess('users', 'edit'), asyncHandler(async (req, res) => {
  const patient = await loadPatient(req);
  if (!patient.userId) throw new HttpError(400, 'This patient has no portal login.');
  const tempPassword = generatePassword();
  await User.updateOne(
    { _id: patient.userId, clinicId: req.clinicId },
    { $set: { passwordHash: await hashPassword(tempPassword) }, $inc: { tokenVersion: 1 } },
  );
  res.json({ loginId: patient.patientCode, tempPassword });
}));

module.exports = router;
