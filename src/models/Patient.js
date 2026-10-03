const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');
const { GENDERS, BLOOD_GROUPS } = require('../constants');

const patientSchema = new Schema(
  {
    patientCode: { type: String, required: true },                  // "PT-1042" — also the portal login ID
    name: { type: String, required: true, trim: true, maxlength: 100 },
    age: { type: Number, min: 0, max: 130, required: true },
    gender: { type: String, enum: GENDERS, required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, default: '' },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    address: { type: String, trim: true, default: '', maxlength: 200 },
    primaryConcern: { type: String, trim: true, required: true, maxlength: 300 },
    allergies: { type: String, trim: true, default: 'None', maxlength: 300 },
    initialTherapy: { type: String, trim: true, default: '' },
    lastTherapy: { type: String, trim: true, default: '' },
    lastVisitDate: { type: String, default: '' },                   // YYYY-MM-DD
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    registeredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
patientSchema.plugin(tenant);
patientSchema.index({ clinicId: 1, patientCode: 1 }, { unique: true });
patientSchema.index({ clinicId: 1, name: 1 });
patientSchema.index({ clinicId: 1, phone: 1 });

module.exports = model('Patient', patientSchema);
