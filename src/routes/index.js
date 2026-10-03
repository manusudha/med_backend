const router = require('express').Router();
const mongoose = require('mongoose');
const { authenticate, requireStaff, requirePatient } = require('../middleware/auth');

router.get('/health', (req, res) => {
  const db = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState];
  res.status(db === 'connected' ? 200 : 503).json({ status: db === 'connected' ? 'ok' : 'degraded', db, time: new Date().toISOString() });
});

router.use('/auth', require('./auth'));
router.use('/platform', require('./platform'));

// Everything below needs a signed-in user
router.use(authenticate);
router.use('/clinic', require('./clinic'));
router.use('/portal', requirePatient, require('./portal'));
router.use('/patients', requireStaff, require('./patients'));
router.use('/appointments', requireStaff, require('./appointments'));
router.use('/admissions', requireStaff, require('./admissions'));
router.use('/prescriptions', requireStaff, require('./prescriptions'));
router.use('/stock', requireStaff, require('./stock'));
router.use('/roles', requireStaff, require('./roles'));
router.use('/users', requireStaff, require('./users'));

module.exports = router;
