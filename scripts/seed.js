/**
 * Demo data — recreates the clinic from the HTML prototype, plus a second
 * clinic so you can see that tenants are isolated.
 *
 *   npm run seed          → creates demo clinics if they don't exist
 *   npm run seed:reset    → deletes the demo clinics and recreates them
 */
const { connectDB, mongoose } = require('../src/config/db');
const {
  Clinic, Counter, Role, User, Patient, Appointment, Admission, DailySheet, Prescription, StockItem,
} = require('../src/models');
const { createClinic, deleteClinicData } = require('../src/services/clinicSetup');
const { hashPassword } = require('../src/utils/security');
const { todayYmd, addDays } = require('../src/utils/dates');

const RESET = process.argv.includes('--reset');

async function seedMetkari() {
  const code = 'metkari';
  const existing = await Clinic.findOne({ code });
  if (existing && !RESET) return console.log(`• "${code}" already exists (use npm run seed:reset to recreate)`);
  if (existing) await deleteClinicData(existing._id);

  const { clinic } = await createClinic({
    name: "Metkari's Clinic", code, subtitle: 'Karad, Satara',
    admin: { name: 'Clinic Admin', loginId: '00001', password: 'admin@2025' },
  });
  const clinicId = clinic._id;
  const t = todayYmd(clinic.timezone);

  // Staff (IDs + passwords from the prototype)
  const staff = [
    ['12345', 'doctor123', 'doctor', 'Dr. Sachin Metkari', 'BAMS · Ayurveda'],
    ['12347', 'doc2pass', 'doctor', 'Dr. Priya Nair', 'MBBS · General'],
    ['12346', 'recep123', 'receptionist', 'Kavita Salve', 'Receptionist'],
    ['12348', 'nurse123', 'nurse', 'Anita More', 'Nurse'],
  ];
  const users = {};
  for (const [loginId, pw, roleKey, name, designation] of staff) {
    users[loginId] = await User.create({ clinicId, loginId, passwordHash: await hashPassword(pw), roleKey, name, designation });
  }
  await Counter.create({ clinicId, key: 'staff', seq: 2349 }); // next staff ID → 12350

  await Role.create({
    clinicId, key: 'lab-technician', name: 'Lab Technician', kind: 'staff', system: false,
    modules: ['sheets', 'patients'], editModules: [],
  });

  // Patients (login = patient code)
  const pts = [
    ['PT-1042', 'pat123', 'Ramesh Desai', 52, 'Male', 'B+', '+91 98765 43210', 'Karad, Satara', 'Chronic back pain', 'None', 'Kati Basti'],
    ['PT-1078', 'pat456', 'Sunita Kulkarni', 38, 'Female', 'A+', '+91 87654 32109', 'Karad, Satara', 'Stress & insomnia', 'None', 'Shirodhara'],
    ['PT-1091', 'patient123', 'Anil Patil', 45, 'Male', 'O+', '+91 76543 21098', 'Patan, Satara', 'Knee joint pain', 'None', 'Abhyanga'],
    ['PT-1103', 'patient123', 'Priya Shinde', 29, 'Female', 'AB-', '+91 65432 10987', 'Satara City', 'Sinusitis', 'None', 'Nasya'],
    ['PT-1055', 'patient123', 'Ganesh More', 61, 'Male', 'B-', '+91 54321 09876', 'Karad', 'Detox', 'Sesame oil', 'Panchakarma'],
    ['PT-1117', 'patient123', 'Meena Jadhav', 44, 'Female', 'A-', '+91 43210 98765', 'Islampur, Sangli', 'Knee arthritis', 'None', 'Janu Basti'],
    ['PT-1122', 'patient123', 'Raju Kamble', 33, 'Male', 'O-', '+91 32109 87654', 'Karad', 'General wellness', 'None', 'General Consultation'],
  ];
  const P = {};
  for (const [patientCode, pw, name, age, gender, bloodGroup, phone, address, primaryConcern, allergies, therapy] of pts) {
    const status = patientCode === 'PT-1122' ? 'inactive' : 'active';
    const p = await Patient.create({
      clinicId, patientCode, name, age, gender, bloodGroup, phone, address, primaryConcern, allergies,
      initialTherapy: therapy, lastTherapy: therapy, status,
    });
    const u = await User.create({
      clinicId, loginId: patientCode, passwordHash: await hashPassword(pw), name, designation: 'Patient',
      roleKey: 'patient', patientId: p._id, status,
    });
    p.userId = u._id;
    await p.save();
    P[patientCode] = p;
  }
  await Counter.create({ clinicId, key: 'patient', seq: 122 }); // next patient → PT-1123

  const doc = users['12345'];
  const appt = (code, date, time, therapy, status, notes = '', source = 'clinic') => ({
    clinicId, patientId: P[code]._id, patientCode: code, patientName: P[code].name, patientAge: P[code].age,
    doctorId: doc._id, doctorName: doc.name, date, time, therapy, status, notes, source,
  });
  await Appointment.insertMany([
    appt('PT-1042', t, '09:00', 'Kati Basti', 'done', '60% relief reported. Advised 3 more sessions.'),
    appt('PT-1078', t, '10:00', 'Shirodhara', 'done'),
    appt('PT-1091', t, '11:30', 'Abhyanga', 'confirmed'),
    appt('PT-1103', t, '13:00', 'Nasya', 'confirmed'),
    appt('PT-1055', t, '14:30', 'Panchakarma', 'confirmed'),
    appt('PT-1117', t, '16:00', 'Janu Basti', 'pending'),
    appt('PT-1122', t, '17:00', 'General Consultation', 'pending'),
    appt('PT-1042', addDays(t, -14), '10:30', 'Kati Basti', 'done', 'Second session. Improved mobility noted.'),
    appt('PT-1042', addDays(t, -27), '09:00', 'General Consultation', 'done', 'Initial consultation. Kati Basti course recommended.'),
    appt('PT-1078', addDays(t, -5), '11:00', 'Shirodhara', 'done'),
    appt('PT-1055', addDays(t, -6), '12:00', 'Panchakarma', 'done'),
    appt('PT-1091', addDays(t, -7), '10:00', 'Abhyanga', 'done'),
    appt('PT-1117', addDays(t, -11), '16:00', 'Janu Basti', 'done'),
    appt('PT-1103', addDays(t, -19), '13:00', 'Nasya', 'done'),
    appt('PT-1042', addDays(t, 2), '10:00', 'Abhyanga', 'confirmed'),
    appt('PT-1042', addDays(t, 9), '', 'Shirodhara', 'pending', '', 'patient'),
  ]);
  for (const code of Object.keys(P)) {
    const last = await Appointment.findOne({ clinicId, patientId: P[code]._id, status: 'done' }).sort({ date: -1 });
    if (last) await Patient.updateOne({ _id: P[code]._id, clinicId }, { $set: { lastVisitDate: last.date, lastTherapy: last.therapy } });
  }

  // Admissions + filled sheets for past days
  const admit = async (code, therapy, daysAgo, plannedDays) => {
    const a = await Admission.create({
      clinicId, patientId: P[code]._id, patientCode: code, patientName: P[code].name, patientAge: P[code].age,
      patientGender: P[code].gender, therapy, concern: P[code].primaryConcern, admitDate: addDays(t, -daysAgo), plannedDays,
    });
    for (let d = 1; d <= daysAgo; d += 1) {
      await DailySheet.create({
        clinicId, admissionId: a._id, patientId: a.patientId, dayNumber: d, date: addDays(a.admitDate, d - 1),
        vitals: { bp: '128/82 mmHg', pulse: '74 / min', temperature: '98.4 °F', weight: '76 kg', spo2: '98%', painLevel: String(Math.max(2, 7 - d)) },
        timetable: {
          wakeUp: 'Warm water, gentle walk, meditation 15 min', morningMedication: 'Maharasnadi Kwath 15ml ✓',
          breakfast: 'Poha with ghee, herbal tea', morningTherapy: `${therapy} — 45 min, patient comfortable`,
          preLunchMedication: 'Yogaraja Guggulu 2 tablets ✓', lunch: 'Dal rice, sabzi, buttermilk',
          afternoonRest: 'Rested 1.5 hrs', eveningSnack: 'Seasonal fruits', eveningTherapy: 'Light walk 15 min',
          dinner: 'Khichdi, warm soup', nightMedication: 'Triphala Churna 1 tsp ✓', sleepNotes: 'Slept well, no complaints',
        },
        medicineCompliance: 'yes', medicineNotes: 'All medicines taken on time.',
        dietCompliance: 'yes', dietNotes: 'Good appetite. Finished all meals.',
        condition: 'improving', doctorNotes: 'Continuing same protocol.', staffNotes: 'Mood positive.',
        filledBy: users['12348']._id, filledByName: 'Anita More',
      });
    }
  };
  await admit('PT-1042', 'Panchakarma', 6, 14);
  await admit('PT-1078', 'Shirodhara', 3, 7);
  await admit('PT-1091', 'Kati Basti', 2, 7);
  await admit('PT-1055', 'Panchakarma', 9, 21);

  const rx = (code, medicine, dosage, duration, purpose, daysAgo) => ({
    clinicId, patientId: P[code]._id, medicine, dosage, duration, purpose,
    prescribedDate: addDays(t, -daysAgo), prescribedBy: doc._id, prescribedByName: doc.name,
  });
  await Prescription.insertMany([
    rx('PT-1042', 'Maharasnadi Kwath', '15ml twice daily before meals', '30 days', 'Joint inflammation', 4),
    rx('PT-1042', 'Yogaraja Guggulu', '2 tablets twice daily', '60 days', 'Vata imbalance', 4),
    rx('PT-1042', 'Sahacharadi Taila', 'External on lower back', 'Ongoing', 'Back pain', 27),
    rx('PT-1078', 'Brahmi Vati', '1 tablet at night', '30 days', 'Sleep', 5),
  ]);

  await StockItem.insertMany([
    ['Maharasnadi Kwath', 'Kwath / Decoction', 12, 'Bottles'], ['Yogaraja Guggulu', 'Tablets / Capsules', 250, 'Tablets'],
    ['Brahmi Vati', 'Tablets / Capsules', 38, 'Tablets'], ['Sahacharadi Taila', 'Medicated Oils', 4, 'Bottles'],
    ['Triphala Churna', 'Churna / Powder', 3, 'Packets'], ['Panchakarma Kit', 'Therapy Supplies', 1, 'Sets'],
    ['Sesame Base Oil', 'Base Oils', 0, 'Litres'], ['Karpura Taila', 'Medicated Oils', 8, 'Bottles'],
    ['Ashwagandha Churna', 'Churna / Powder', 6, 'Packets'], ['Navarakizhi Rice', 'Therapy Supplies', 2, 'Kg'],
  ].map(([name, category, quantity, unit]) => ({ clinicId, name, category, quantity, unit, lowThreshold: 5, updatedByName: 'Seed' })));

  console.log(`✔ Seeded "${clinic.name}" (code: ${code})`);
}

async function seedSecondClinic() {
  const code = 'sunrise';
  const existing = await Clinic.findOne({ code });
  if (existing && !RESET) return console.log(`• "${code}" already exists`);
  if (existing) await deleteClinicData(existing._id);
  await createClinic({
    name: 'Sunrise Hospital', code, subtitle: 'Pune',
    admin: { name: 'Sunrise Admin', loginId: 'admin', password: 'sunrise@2025' },
  });
  console.log('✔ Seeded "Sunrise Hospital" (code: sunrise) — empty clinic to test isolation');
}

(async () => {
  await connectDB();
  await Promise.all([Clinic, Counter, Role, User, Patient, Appointment, Admission, DailySheet, Prescription, StockItem].map((M) => M.init()));
  await seedMetkari();
  await seedSecondClinic();
  console.log(`
Demo logins
  Clinic code: metkari
    Admin         00001    / admin@2025
    Doctor        12345    / doctor123
    Receptionist  12346    / recep123
    Nurse         12348    / nurse123
    Patient       PT-1042  / pat123
  Clinic code: sunrise
    Admin         admin    / sunrise@2025
`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
