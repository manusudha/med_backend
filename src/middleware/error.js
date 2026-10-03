const { ZodError } = require('zod');
const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: err.issues[0]?.message || 'Please check the form and try again.',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).filter((k) => k !== 'clinicId').join(', ');
    return res.status(409).json({ message: `A record with this ${field || 'value'} already exists.` });
  }
  if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid value sent.' });
  if (err && err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first ? first.message : 'Invalid data.' });
  }
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body.' });

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({
    message: status >= 500 && env.isProd ? 'Something went wrong on the server. Please try again.' : err.message,
  });
}

module.exports = { notFound, errorHandler };
