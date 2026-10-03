const { z } = require('zod');
const mongoose = require('mongoose');
const { HttpError } = require('../utils/http');

/** Validate req.body with a zod schema; replaces req.body with the clean result. */
const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) return next(r.error);
  req.body = r.data;
  return next();
};

/** 404s early when :param is not a valid ObjectId */
const validId = (...params) => (req, res, next) => {
  const bad = params.find((p) => !mongoose.isValidObjectId(req.params[p]));
  return bad ? next(new HttpError(404, 'Record not found.')) : next();
};

// Reusable zod fields
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time');
const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid ID');
const text = (max = 200) => z.string().trim().max(max);
const reqText = (label, max = 200) => z.string({ required_error: `${label} is required` })
  .trim().min(1, `${label} is required`).max(max);

module.exports = { validate, validId, z, ymd, hhmm, objectId, text, reqText };
