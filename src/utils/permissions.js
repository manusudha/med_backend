const { MODULE_KEYS } = require('../constants');

/**
 * Work out what a user can do.
 * Result: { kind, isAdmin, isPatient, roleKey, roleName, modules: { appointments: 'edit' | 'view', ... } }
 * A staff user may have a personal access override (set from User Management);
 * otherwise their role's permissions apply.
 */
function computePermissions(user, role) {
  const modules = {};
  if (role.kind === 'admin') {
    MODULE_KEYS.forEach((k) => { modules[k] = 'edit'; });
  } else if (role.kind === 'staff') {
    const src = user.accessOverride && user.accessOverride.enabled ? user.accessOverride : role;
    (src.modules || []).forEach((k) => {
      if (MODULE_KEYS.includes(k)) modules[k] = (src.editModules || []).includes(k) ? 'edit' : 'view';
    });
  }
  return {
    kind: role.kind,
    isAdmin: role.kind === 'admin',
    isPatient: role.kind === 'patient',
    roleKey: role.key,
    roleName: role.name,
    modules,
  };
}

function can(perms, module, level = 'view') {
  const a = perms && perms.modules[module];
  return level === 'edit' ? a === 'edit' : Boolean(a);
}

module.exports = { computePermissions, can };
