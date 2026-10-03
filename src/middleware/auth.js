const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Clinic, User, Role } = require('../models');
const { HttpError, asyncHandler } = require('../utils/http');
const { computePermissions, can } = require('../utils/permissions');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), cid: String(user.clinicId), tv: user.tokenVersion || 0 }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Verifies the Bearer token and loads the user, their clinic and role on every
 * request — so disabling a user, suspending a clinic or changing a role takes
 * effect immediately, not when the token expires.
 * Sets: req.user, req.clinic, req.clinicId, req.role, req.perms
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  const [user, clinic] = await Promise.all([
    User.findOne({ _id: payload.sub, clinicId: payload.cid }).lean(),
    Clinic.findById(payload.cid).lean(),
  ]);
  if (!user || (user.tokenVersion || 0) !== payload.tv) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  if (user.status !== 'active') throw new HttpError(401, 'This account is disabled. Contact your clinic admin.');
  if (!clinic || clinic.status !== 'active') throw new HttpError(401, 'This clinic account is not active.');

  const role = await Role.findOne({ clinicId: clinic._id, key: user.roleKey }).lean();
  if (!role) throw new HttpError(403, 'Your role no longer exists. Contact your clinic admin.');

  req.user = user;
  req.clinic = clinic;
  req.clinicId = clinic._id;
  req.role = role;
  req.perms = computePermissions(user, role);
  next();
});

const denied = () => new HttpError(403, "You don't have permission to do this.");

/** requireAccess('appointments') or requireAccess('appointments', 'edit') */
const requireAccess = (module, level = 'view') => (req, res, next) =>
  (can(req.perms, module, level) ? next() : next(denied()));

/** requireAny([['patients'], ['users', 'edit']]) → passes if any pair is allowed */
const requireAny = (pairs) => (req, res, next) =>
  (pairs.some(([m, l]) => can(req.perms, m, l || 'view')) ? next() : next(denied()));

const requireAdmin = (req, res, next) => (req.perms.isAdmin ? next() : next(denied()));
const requirePatient = (req, res, next) => (req.perms.isPatient ? next() : next(denied()));
const requireStaff = (req, res, next) => (!req.perms.isPatient ? next() : next(denied()));

module.exports = { signToken, authenticate, requireAccess, requireAny, requireAdmin, requirePatient, requireStaff };
