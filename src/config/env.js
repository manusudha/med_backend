const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`✖ Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  process.exit(1);
}
if (process.env.MONGODB_URI.startsWith('PASTE_')) {
  console.error('✖ MONGODB_URI in server/.env still has the placeholder. Paste your MongoDB connection string there.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('✖ JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  PLATFORM_ADMIN_KEY: process.env.PLATFORM_ADMIN_KEY || '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  TRUST_PROXY: Number(process.env.TRUST_PROXY) || 0,
  SERVE_CLIENT: process.env.SERVE_CLIENT === 'true',
  CLIENT_DIST: path.resolve(__dirname, '../../../client/dist'),
  BCRYPT_ROUNDS: 10,
};
env.isProd = env.NODE_ENV === 'production';

module.exports = env;
