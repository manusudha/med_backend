const { Schema } = require('mongoose');

/**
 * Multi-tenant guard.
 *
 * Every tenant collection gets a required, indexed `clinicId`, and every
 * query/update/delete MUST filter by clinicId — otherwise it throws.
 * This makes it impossible to accidentally read or change another clinic's data
 * (e.g. using findById without a clinic filter).
 *
 * Deliberate cross-clinic operations (platform owner tools, scripts) can opt out
 * with `.setOptions({ skipTenant: true })`.
 */
const QUERY_OPS = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'countDocuments', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne', 'distinct',
];

module.exports = function tenantPlugin(schema) {
  schema.add({ clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true, immutable: true } });

  QUERY_OPS.forEach((op) => {
    schema.pre(op, { document: false, query: true }, function guard(next) {
      if (this.getOptions().skipTenant) return next();
      const filter = this.getFilter() || {};
      if (!filter.clinicId) {
        return next(new Error(`Tenant guard: ${this.model.modelName}.${op}() called without clinicId`));
      }
      return next();
    });
  });

  schema.pre('aggregate', function guardAggregate(next) {
    if (this.options && this.options.skipTenant) return next();
    const first = this.pipeline()[0];
    if (!first || !first.$match || !first.$match.clinicId) {
      return next(new Error('Tenant guard: aggregate() must start with $match on clinicId'));
    }
    return next();
  });
};
