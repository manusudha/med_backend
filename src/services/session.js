const { User } = require('../models');
const { computePermissions } = require('../utils/permissions');
const { MODULES } = require('../constants');

/** What the frontend receives after login and on /auth/me */
function sessionPayload(user, role, clinic) {
  return {
    user: User.toPublic(user, role),
    clinic: {
      id: clinic._id, name: clinic.name, code: clinic.code, subtitle: clinic.subtitle,
      timezone: clinic.timezone, settings: clinic.settings,
    },
    permissions: computePermissions(user, role),
    modules: MODULES,
  };
}

module.exports = { sessionPayload };
