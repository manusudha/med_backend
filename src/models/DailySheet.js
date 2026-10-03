const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');

const s = { type: String, trim: true, default: '', maxlength: 500 };
const long = { type: String, trim: true, default: '', maxlength: 3000 };

/** One day's record for an admitted patient (vitals, timetable, compliance, notes). */
const dailySheetSchema = new Schema(
  {
    admissionId: { type: Schema.Types.ObjectId, ref: 'Admission', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    dayNumber: { type: Number, required: true, min: 1 },
    date: { type: String, required: true },           // YYYY-MM-DD
    vitals: { bp: s, pulse: s, temperature: s, weight: s, spo2: s, painLevel: s },
    timetable: {
      wakeUp: s, morningMedication: s, breakfast: s, morningTherapy: s, preLunchMedication: s, lunch: s,
      afternoonRest: s, eveningSnack: s, eveningTherapy: s, dinner: s, nightMedication: s, sleepNotes: s,
    },
    medicineCompliance: { type: String, enum: ['', 'yes', 'partial', 'no'], default: '' },
    medicineNotes: long,
    dietCompliance: { type: String, enum: ['', 'yes', 'partial', 'no'], default: '' },
    dietNotes: long,
    condition: { type: String, enum: ['', 'improving', 'stable', 'attention'], default: '' },
    doctorNotes: long,
    staffNotes: long,
    filledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    filledByName: { type: String, default: '' },
  },
  { timestamps: true },
);
dailySheetSchema.plugin(tenant);
dailySheetSchema.index({ clinicId: 1, admissionId: 1, dayNumber: 1 }, { unique: true });
dailySheetSchema.index({ clinicId: 1, patientId: 1, date: -1 });

module.exports = model('DailySheet', dailySheetSchema);
