class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Express 4 does not catch async errors — wrap every async handler with this. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Parse ?page=&limit= safely. */
function paging(query, defLimit = 25, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Read a plain string from req.query (ignores arrays/objects). */
const qstr = (v) => (typeof v === 'string' ? v.trim() : '');

module.exports = { HttpError, asyncHandler, escapeRegex, paging, qstr };
