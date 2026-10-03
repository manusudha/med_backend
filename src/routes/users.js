const router = require('express').Router();
const { User, Role, nextSequence } = require('../models');
const { asyncHandler, HttpError, escapeRegex, qstr } = require('../utils/http');
const { validate, validId, z, text, reqText } = require('../middleware/validate');
const { requireAccess, requireAny } = require('../middleware/auth');
const { hashPassword, generatePassword } = require('../utils/security');
const { computePermissions } = require('../utils/permissions');
const { MODULE_KEYS } = require('../constants');

const STAFF_ID_START = 10000;

async function staffRole(req, key) {
  const role = await Role.findOne({ clinicId: req.clinicId, key, kind: { $in: ['staff', 'admin'] } }).lean();
  if (!role) throw new HttpError(400, 'Select a valid role.');
  return role;
}

async function withRoles(req, users) {
  const roles = await Role.find({ clinicId: req.clinicId, key: { $in: [...new Set(users.map((u) => u.roleKey))] } }).lean();
  const byKey = Object.fromEntries(roles.map((r) => [r.key, r]));
  return users.map((u) => ({
    ...User.toPublic(u, byKey[u.roleKey]),
    permissions: byKey[u.roleKey] ? computePermissions(u, byKey[u.roleKey]).modules : {},
  }));
}

// GET /api/users/doctors — for appointment forms
router.get('/doctors', requireAny([['appointments']]), asyncHandler(async (req, res) => {
  const items = await User.find({ clinicId: req.clinicId, roleKey: 'doctor', status: 'active' })
    .select('name designation').sort({ name: 1 }).lean();
  res.json({ items: items.map((d) => ({ id: d._id, name: d.name, designation: d.designation })) });
}));

// GET /api/users?q=&status= — staff & admins (patients are managed under /patients)
router.get('/', requireAccess('users'), asyncHandler(async (req, res) => {
  const filter = { clinicId: req.clinicId, roleKey: { $ne: 'patient' } };
  const q = qstr(req.query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { loginId: rx }];
  }
  const status = qstr(req.query.status);
  if (['active', 'inactive'].includes(status)) filter.status = status;
  const users = await User.find(filter).sort({ createdAt: 1 }).limit(500).lean();
  res.json({ items: await withRoles(req, users) });
}));

// POST /api/users — create a staff account (numeric login ID auto-assigned)
router.post('/', requireAccess('users', 'edit'), validate(z.object({
  name: reqText('Full name', 100),
  roleKey: reqText('Role', 60),
  designation: text(80).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(200),
})), asyncHandler(async (req, res) => {
  const role = await staffRole(req, req.body.roleKey);
  if (role.kind === 'admin' && !req.perms.isAdmin) throw new HttpError(403, 'Only an admin can create another admin.');

  // Skip any ID that is already taken (e.g. imported users)
  let loginId;
  for (let i = 0; i < 20 && !loginId; i += 1) {
    const candidate = String(STAFF_ID_START + (await nextSequence(req.clinicId, 'staff')));
    // eslint-disable-next-line no-await-in-loop
    if (!(await User.exists({ clinicId: req.clinicId, loginId: candidate }))) loginId = candidate;
  }
  if (!loginId) throw new HttpError(500, 'Could not allocate a staff ID. Try again.');

  const user = await User.create({
    clinicId: req.clinicId,
    loginId,
    passwordHash: await hashPassword(req.body.password),
    name: req.body.name,
    designation: req.body.designation || role.name,
    roleKey: role.key,
  });
  const [out] = await withRoles(req, [user.toObject()]);
  res.status(201).json(out);
}));

// PATCH /api/users/:id — status, role, details, personal access override
router.patch('/:id', validId('id'), requireAccess('users', 'edit'), validate(z.object({
  name: reqText('Full name', 100).optional(),
  designation: text(80).optional(),
  roleKey: reqText('Role', 60).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  accessOverride: z.object({
    enabled: z.boolean(),
    modules: z.array(z.enum(MODULE_KEYS)).default([]),
    editModules: z.array(z.enum(MODULE_KEYS)).default([]),
  }).optional(),
})), asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!user) throw new HttpError(404, 'User not found.');
  if (user.roleKey === 'patient') throw new HttpError(400, 'Manage patient accounts from Patients.');
  const isSelf = String(user._id) === String(req.user._id);
  const b = req.body;

  if (isSelf && (b.status === 'inactive' || (b.roleKey && b.roleKey !== user.roleKey))) {
    throw new HttpError(400, "You can't disable your own account or change your own role.");
  }
  if (user.roleKey === 'admin' && !req.perms.isAdmin) throw new HttpError(403, 'Only an admin can change an admin account.');

  let forceLogout = false;
  const roleChanged = Boolean(b.roleKey && b.roleKey !== user.roleKey);
  if (roleChanged) {
    const role = await staffRole(req, b.roleKey);
    if (role.kind === 'admin' && !req.perms.isAdmin) throw new HttpError(403, 'Only an admin can assign the admin role.');
    if (user.roleKey === 'admin') await ensureAnotherAdmin(req, user);
    user.roleKey = role.key;
    user.accessOverride = { enabled: false, modules: [], editModules: [] };
    forceLogout = true;
  }
  if (b.status && b.status !== user.status) {
    if (b.status === 'inactive' && user.roleKey === 'admin') await ensureAnotherAdmin(req, user);
    user.status = b.status;
    if (b.status === 'inactive') forceLogout = true;
  }
  if (b.name) user.name = b.name;
  if (b.designation !== undefined) user.designation = b.designation;
  if (b.accessOverride && !roleChanged) {
    const m = [...new Set(b.accessOverride.modules)];
    user.accessOverride = b.accessOverride.enabled
      ? { enabled: true, modules: m, editModules: [...new Set(b.accessOverride.editModules)].filter((k) => m.includes(k)) }
      : { enabled: false, modules: [], editModules: [] };
  }
  if (forceLogout) user.tokenVersion += 1;
  await user.save();
  const [out] = await withRoles(req, [user.toObject()]);
  res.json(out);
}));

async function ensureAnotherAdmin(req, user) {
  const others = await User.countDocuments({ clinicId: req.clinicId, roleKey: 'admin', status: 'active', _id: { $ne: user._id } });
  if (!others) throw new HttpError(400, 'The clinic needs at least one active admin.');
}

// POST /api/users/:id/reset-password — { password? } → sets it or generates one
router.post('/:id/reset-password', validId('id'), requireAccess('users', 'edit'), validate(z.object({
  password: z.string().min(6, 'Password must be at least 6 characters').max(200).optional(),
})), asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!user) throw new HttpError(404, 'User not found.');
  if (user.roleKey === 'admin' && !req.perms.isAdmin) throw new HttpError(403, 'Only an admin can reset an admin password.');
  const password = req.body.password || generatePassword();
  user.passwordHash = await hashPassword(password);
  user.tokenVersion += 1;
  await user.save();
  res.json({ loginId: user.loginId, tempPassword: req.body.password ? undefined : password, message: 'Password updated.' });
}));

module.exports = router;
