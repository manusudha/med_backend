const { Clinic, Role, User, TENANT_MODELS } = require('../models');
const { DEFAULT_ROLES } = require('../constants');
const { hashPassword } = require('../utils/security');

/**
 * Onboard a new client clinic: creates the clinic, its default roles and its
 * first admin account. If anything fails, everything created is rolled back.
 */
async function createClinic({ name, code, subtitle = '', timezone = 'Asia/Kolkata', plan = 'trial', admin }) {
  const clinic = await Clinic.create({ name, code, subtitle, timezone, plan });
  try {
    await Role.insertMany(DEFAULT_ROLES.map((r) => ({ ...r, clinicId: clinic._id })));
    const adminUser = await User.create({
      clinicId: clinic._id,
      loginId: admin.loginId || 'admin',
      passwordHash: await hashPassword(admin.password),
      name: admin.name || 'Clinic Admin',
      designation: 'Administrator',
      roleKey: 'admin',
    });
    return { clinic, adminUser };
  } catch (err) {
    await deleteClinicData(clinic._id);
    throw err;
  }
}

/** Permanently removes a clinic and all of its data. */
async function deleteClinicData(clinicId) {
  await Promise.all(TENANT_MODELS.map((M) => M.deleteMany({ clinicId })));
  await Clinic.deleteOne({ _id: clinicId });
}

module.exports = { createClinic, deleteClinicData };
