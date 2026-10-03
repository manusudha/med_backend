/**
 * Blocks MongoDB operator injection: removes any key that starts with "$"
 * or contains "." from body and params (query strings are read with qstr()).
 */
function clean(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return;
  Object.keys(obj).forEach((k) => {
    if (k.startsWith('$') || k.includes('.')) delete obj[k];
    else clean(obj[k], depth + 1);
  });
}

module.exports = function sanitize(req, res, next) {
  clean(req.body);
  clean(req.params);
  next();
};
