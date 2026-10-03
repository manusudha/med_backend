const { Schema, model } = require('mongoose');
const { DEFAULT_THERAPIES, DEFAULT_STOCK_CATEGORIES, DEFAULT_STOCK_UNITS } = require('../constants');

/** A tenant (one hospital/clinic that subscribes to the SaaS). */
const clinicSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Short unique code staff type at login, e.g. "metkari"
    code: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      match: [/^[a-z0-9-]{3,30}$/, 'Clinic code: 3–30 letters, numbers or dashes'],
    },
    subtitle: { type: String, trim: true, default: '', maxlength: 120 }, // e.g. "Karad, Satara"
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    plan: { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    settings: {
      therapies: { type: [String], default: () => [...DEFAULT_THERAPIES] },
      stockCategories: { type: [String], default: () => [...DEFAULT_STOCK_CATEGORIES] },
      stockUnits: { type: [String], default: () => [...DEFAULT_STOCK_UNITS] },
    },
  },
  { timestamps: true },
);

clinicSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id, name: this.name, code: this.code, subtitle: this.subtitle, phone: this.phone,
    email: this.email, address: this.address, timezone: this.timezone, plan: this.plan, settings: this.settings,
  };
};

module.exports = model('Clinic', clinicSchema);
