const router = require('express').Router();
const crypto = require('crypto');
const { Role, User } = require('../models');
const { asyncHandler, HttpError } = require('../utils/http');
const { validate, validId, z, reqText } = require('../middleware/validate');
const { requireAdmin, requireAny } = require('../middleware/auth');
const { MODULE_KEYS } = require('../constants');

const moduleList = z.array(z.enum(MODULE_KEYS)).max(MODULE_KEYS.length);
const cleanPerms = ({ modules = [], editModules = [] }) => {
  const m = [...new Set(modules)];
  return { modules: m, editModules: [...new Set(editModules)].filter((k) => m.includes(k)) }; // edit ⊆ access
};

// GET /api/roles — staff roles (plus admin with ?all=1)
router.get('/', requireAny([['users']]), asyncHandler(async (req, res) => {
  const kinds = req.query.all === '1' ? ['admin', 'staff'] : ['staff'];
  const roles = await Role.find({ clinicId: req.clinicId, kind: { $in: kinds } }).sort({ system: -1, createdAt: 1 }).lean();
  const counts = await User.aggregate([
    { $match: { clinicId: req.clinicId, roleKey: { $in: roles.map((r) => r.key) } } },
    { $group: { _id: '$roleKey', n: { $sum: 1 } } },
  ]);
  const byKey = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json({ items: roles.map((r) => ({ ...r, userCount: byKey[r.key] || 0 })) });
}));

// POST /api/roles — create a custom role
router.post('/', requireAdmin, validate(z.object({
  name: reqText('Role name', 60),
  modules: moduleList.default([]),
  editModules: moduleList.default([]),
})), asyncHandler(async (req, res) => {
  const slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'role';
  const role = await Role.create({
    clinicId: req.clinicId,
    key: `${slug}-${crypto.randomBytes(3).toString('hex')}`,
    name: req.body.name,
    kind: 'staff',
    system: false,
    ...cleanPerms(req.body),
  });
  res.status(201).json(role);
}));

// PATCH /api/roles/:id
router.patch('/:id', validId('id'), requireAdmin, validate(z.object({
  name: reqText('Role name', 60).optional(),
  modules: moduleList.optional(),
  editModules: moduleList.optional(),
})), asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!role) throw new HttpError(404, 'Role not found.');
  if (role.kind !== 'staff') throw new HttpError(400, 'Admin and patient roles cannot be changed.');
  if (req.body.name) role.name = req.body.name;
  if (req.body.modules || req.body.editModules) {
    Object.assign(role, cleanPerms({
      modules: req.body.modules || role.modules,
      editModules: req.body.editModules || role.editModules,
    }));
  }
  await role.save();
  res.json(role);
}));

// DELETE /api/roles/:id — custom roles only, and only when nobody uses it
router.delete('/:id', validId('id'), requireAdmin, asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!role) throw new HttpError(404, 'Role not found.');
  if (role.system) throw new HttpError(400, 'System roles cannot be deleted.');
  const inUse = await User.countDocuments({ clinicId: req.clinicId, roleKey: role.key });
  if (inUse) throw new HttpError(409, `${inUse} staff member(s) still have this role. Change their role first.`);
  await Role.deleteOne({ _id: role._id, clinicId: req.clinicId });
  res.json({ message: 'Role deleted.' });
}));

module.exports = router;
