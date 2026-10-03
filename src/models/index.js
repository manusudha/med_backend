const Clinic = require('./Clinic');
const { Counter, nextSequence } = require('./Counter');
const Role = require('./Role');
const User = require('./User');
const Patient = require('./Patient');
const Appointment = require('./Appointment');
const Admission = require('./Admission');
const DailySheet = require('./DailySheet');
const Prescription = require('./Prescription');
const StockItem = require('./StockItem');

/** Every collection that belongs to a clinic (used for clean-up). */
const TENANT_MODELS = [Counter, Role, User, Patient, Appointment, Admission, DailySheet, Prescription, StockItem];

module.exports = {
  Clinic, Counter, nextSequence, Role, User, Patient, Appointment, Admission, DailySheet, Prescription, StockItem,
  TENANT_MODELS,
};
