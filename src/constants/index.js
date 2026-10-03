/**
 * Modules a clinic role can be given access to.
 * The "key" is what is stored in the DB; "label" is what users see.
 */
const MODULES = [
  { key: 'appointments', label: 'Appointments' },
  { key: 'patients', label: 'Patient Registry' },
  { key: 'addPatient', label: 'Add Patient' },
  { key: 'sheets', label: 'Patient Sheet' },
  { key: 'stock', label: 'Medicines & Supplies' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'users', label: 'User Management' },
];
const MODULE_KEYS = MODULES.map((m) => m.key);

/** Roles created for every new clinic. kind: admin | staff | patient */
const DEFAULT_ROLES = [
  { key: 'admin', name: 'Admin', kind: 'admin', system: true, modules: MODULE_KEYS, editModules: MODULE_KEYS },
  {
    key: 'doctor', name: 'Doctor', kind: 'staff', system: true,
    modules: ['appointments', 'patients', 'addPatient', 'sheets', 'stock', 'prescriptions'],
    editModules: ['appointments', 'patients', 'addPatient', 'sheets', 'stock', 'prescriptions'],
  },
  {
    key: 'receptionist', name: 'Receptionist', kind: 'staff', system: true,
    modules: ['appointments', 'patients', 'addPatient'],
    editModules: ['appointments', 'addPatient'],
  },
  {
    key: 'nurse', name: 'Nurse', kind: 'staff', system: true,
    modules: ['sheets', 'appointments', 'patients', 'addPatient'],
    editModules: ['sheets', 'addPatient'],
  },
  { key: 'patient', name: 'Patient', kind: 'patient', system: true, modules: [], editModules: [] },
];

const DEFAULT_THERAPIES = [
  'General Consultation', 'Shirodhara', 'Panchakarma', 'Abhyanga', 'Kati Basti', 'Janu Basti', 'Nasya',
];
const DEFAULT_STOCK_CATEGORIES = [
  'Kwath / Decoction', 'Tablets / Capsules', 'Churna / Powder', 'Medicated Oils', 'Base Oils', 'Therapy Supplies',
];
const DEFAULT_STOCK_UNITS = ['Tablets', 'Bottles', 'Packets', 'Litres', 'Kg', 'Sets', 'Units'];

const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'done', 'cancelled'];
const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', ''];

module.exports = {
  MODULES, MODULE_KEYS, DEFAULT_ROLES, DEFAULT_THERAPIES, DEFAULT_STOCK_CATEGORIES,
  DEFAULT_STOCK_UNITS, APPOINTMENT_STATUSES, GENDERS, BLOOD_GROUPS,
};
