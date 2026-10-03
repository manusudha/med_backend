const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');
const { MODULE_KEYS } = require('../constants');

const roleSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },       // "doctor", "nurse", "lab-technician-x7k2"
    name: { type: String, required: true, trim: true, maxlength: 60 },
    kind: { type: String, enum: ['admin', 'staff', 'patient'], required: true },
    system: { type: Boolean, default: false },                // system roles cannot be deleted
    modules: [{ type: String, enum: MODULE_KEYS }],           // modules this role can open
    editModules: [{ type: String, enum: MODULE_KEYS }],       // subset of modules it can also edit
  },
  { timestamps: true },
);
roleSchema.plugin(tenant);
roleSchema.index({ clinicId: 1, key: 1 }, { unique: true });

module.exports = model('Role', roleSchema);
