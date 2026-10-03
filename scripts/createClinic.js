/**
 * Onboard a new client clinic from the command line.
 *
 *   npm run create-clinic -- --name "Sunrise Hospital" --code sunrise --subtitle "Pune" \
 *        --admin-name "Dr. Rao" --admin-id admin --admin-password "StrongPass@123"
 */
const { connectDB, mongoose } = require('../src/config/db');
const { Clinic } = require('../src/models');
const { createClinic } = require('../src/services/clinicSetup');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

(async () => {
  const name = arg('name');
  const code = (arg('code') || '').toLowerCase();
  const password = arg('admin-password');
  if (!name || !code || !password) {
    console.log('Usage: npm run create-clinic -- --name "Clinic Name" --code clinic-code --admin-password "Secret123" [--subtitle "City"] [--admin-id admin] [--admin-name "Name"] [--timezone Asia/Kolkata]');
    process.exit(1);
  }
  if (password.length < 8) throw new Error('Admin password must be at least 8 characters.');
  await connectDB();
  if (await Clinic.exists({ code })) throw new Error(`Clinic code "${code}" is already taken.`);
  const { clinic, adminUser } = await createClinic({
    name, code, subtitle: arg('subtitle') || '', timezone: arg('timezone') || 'Asia/Kolkata',
    admin: { name: arg('admin-name') || 'Clinic Admin', loginId: arg('admin-id') || 'admin', password },
  });
  console.log(`✔ Created "${clinic.name}"\n  Clinic code: ${clinic.code}\n  Admin login: ${adminUser.loginId}`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('✖', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
