const { Schema, model } = require('mongoose');
const tenant = require('./plugins/tenant');

/** Per-clinic sequence numbers (staff IDs, patient codes). */
const counterSchema = new Schema({
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
counterSchema.plugin(tenant);
counterSchema.index({ clinicId: 1, key: 1 }, { unique: true });

const Counter = model('Counter', counterSchema);

async function nextSequence(clinicId, key) {
  try {
    const doc = await Counter.findOneAndUpdate(
      { clinicId, key }, { $inc: { seq: 1 } }, { upsert: true, new: true },
    );
    return doc.seq;
  } catch (err) {
    if (err.code === 11000) return nextSequence(clinicId, key); // two upserts raced — retry
    throw err;
  }
}

module.exports = { Counter, nextSequence };
