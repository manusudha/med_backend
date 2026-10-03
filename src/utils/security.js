const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const hashPassword = (plain) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);
const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** Readable temporary password (no 0/O/1/l confusion). */
function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[crypto.randomInt(chars.length)];
  return out;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function initialsOf(name = '') {
  const parts = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

module.exports = { hashPassword, checkPassword, generatePassword, safeEqual, initialsOf };
