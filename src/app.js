const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/error');
const { HttpError } = require('./utils/http');
const { connectDB } = require('./config/db');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    },
  },
}));
// CORS only matters for the API. Same-origin requests (client served by this
// server via SERVE_CLIENT) are always allowed; other origins must be listed.
app.use('/api', cors((req, cb) => {
  const origin = req.header('Origin');
  const selfOrigin = `${req.protocol}://${req.get('host')}`;
  if (!origin || origin === selfOrigin || env.CORS_ORIGINS.includes(origin)) {
    return cb(null, { origin: true });
  }
  return cb(new HttpError(403, `Origin ${origin} is not allowed. Add it to CORS_ORIGINS in server/.env`));
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(sanitize);
app.use(morgan(env.isProd ? 'combined' : 'dev'));
// Make sure MongoDB is connected before handling any API request.
// Needed on Vercel (serverless); connectDB is cached, so it's cheap locally too.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    res.status(503).json({ message: 'Database unavailable. Please try again.' });
  }
});

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
}));
app.use('/api', require('./routes'));
app.use('/api', notFound);

// Optional: serve the built React PWA from the same server (one deployment)
if (env.SERVE_CLIENT && fs.existsSync(env.CLIENT_DIST)) {
  app.use(express.static(env.CLIENT_DIST, {
    maxAge: '7d',
    setHeaders(res, file) {
      if (/(index\.html|sw\.js|workbox-.*\.js|manifest\.webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get('*', (req, res) => res.sendFile(path.join(env.CLIENT_DIST, 'index.html')));
}

app.use(errorHandler);

module.exports = app;
