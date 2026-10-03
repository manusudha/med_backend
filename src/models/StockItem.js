const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');

const stockItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameKey: { type: String, required: true },            // lowercase name → case-insensitive uniqueness
    category: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, default: 'Units' },
    lowThreshold: { type: Number, min: 0, default: 5 },   // at or below this = "Low Stock"
    updatedByName: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);
stockItemSchema.plugin(tenant);
stockItemSchema.index({ clinicId: 1, nameKey: 1 }, { unique: true });

stockItemSchema.statics.keyOf = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ');
stockItemSchema.pre('validate', function setKey(next) {
  if (this.name) this.nameKey = this.constructor.keyOf(this.name);
  next();
});

stockItemSchema.virtual('stockStatus').get(function stockStatus() {
  if (this.quantity <= 0) return 'out';
  if (this.quantity <= this.lowThreshold) return 'low';
  return 'ok';
});

module.exports = model('StockItem', stockItemSchema);
