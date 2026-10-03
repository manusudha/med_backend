const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');

/** An in-patient stay. Daily sheets hang off an admission. */
const admissionSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientCode: { type: String, required: true },
    patientName: { type: String, required: true },
    patientAge: { type: Number },
    patientGender: { type: String },
    therapy: { type: String, required: true, trim: true },
    concern: { type: String, trim: true, default: '' },
    admitDate: { type: String, required: true },      // YYYY-MM-DD
    plannedDays: { type: Number, min: 1, max: 365, required: true },
    status: { type: String, enum: ['admitted', 'discharged'], default: 'admitted' },
    dischargeDate: { type: String, default: '' },
    admittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
admissionSchema.plugin(tenant);
admissionSchema.index({ clinicId: 1, status: 1, admitDate: -1 });
admissionSchema.index({ clinicId: 1, patientId: 1 });

module.exports = model('Admission', admissionSchema);
