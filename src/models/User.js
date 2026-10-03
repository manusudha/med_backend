const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');
const { MODULE_KEYS } = require('../constants');
const { initialsOf } = require('../utils/security');

/** Anyone who can sign in: admin, doctors, staff, and patients (portal). */
const userSchema = new Schema(
  {
    loginId: { type: String, required: true, trim: true },           // "12345" or "PT-1042" — unique per clinic
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    designation: { type: String, trim: true, default: '', maxlength: 80 }, // "BAMS · Ayurveda"
    roleKey: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    // Optional per-person access that replaces the role defaults
    accessOverride: {
      enabled: { type: Boolean, default: false },
      modules: [{ type: String, enum: MODULE_KEYS }],
      editModules: [{ type: String, enum: MODULE_KEYS }],
    },
    // Bumped on password reset / disable / role change → old tokens stop working
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
userSchema.plugin(tenant);
userSchema.index({ clinicId: 1, loginId: 1 }, { unique: true });
userSchema.index({ clinicId: 1, roleKey: 1 });

userSchema.statics.toPublic = function toPublic(u, role) {
  return {
    id: u._id,
    loginId: u.loginId,
    name: u.name,
    designation: u.designation,
    initials: initialsOf(u.name),
    roleKey: u.roleKey,
    roleName: role ? role.name : undefined,
    status: u.status,
    patientId: u.patientId || null,
    accessOverride: u.accessOverride && u.accessOverride.enabled ? u.accessOverride : { enabled: false, modules: [], editModules: [] },
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
};

module.exports = model('User', userSchema);
