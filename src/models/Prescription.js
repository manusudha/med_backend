const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');

const prescriptionSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    medicine: { type: String, required: true, trim: true, maxlength: 120 },
    dosage: { type: String, trim: true, default: '', maxlength: 200 },     // "15ml twice daily"
    duration: { type: String, trim: true, default: '', maxlength: 60 },    // "30 days" / "Ongoing"
    purpose: { type: String, trim: true, default: '', maxlength: 200 },
    prescribedDate: { type: String, required: true },                       // YYYY-MM-DD
    prescribedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    prescribedByName: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
prescriptionSchema.plugin(tenant);
prescriptionSchema.index({ clinicId: 1, patientId: 1, prescribedDate: -1 });

module.exports = model('Prescription', prescriptionSchema);
