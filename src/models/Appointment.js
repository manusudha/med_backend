const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');
const { APPOINTMENT_STATUSES } = require('../constants');

const appointmentSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    // Snapshots so lists render without joins
    patientCode: { type: String, required: true },
    patientName: { type: String, required: true },
    patientAge: { type: Number },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    doctorName: { type: String, default: '' },
    date: { type: String, required: true },          // YYYY-MM-DD (clinic timezone)
    time: { type: String, default: '' },             // HH:mm, empty = not yet scheduled (patient request)
    therapy: { type: String, required: true, trim: true },
    concern: { type: String, trim: true, default: '', maxlength: 300 },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'confirmed' },
    source: { type: String, enum: ['clinic', 'patient'], default: 'clinic' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
appointmentSchema.plugin(tenant);
appointmentSchema.index({ clinicId: 1, date: 1, time: 1 });
appointmentSchema.index({ clinicId: 1, patientId: 1, date: -1 });

module.exports = model('Appointment', appointmentSchema);
