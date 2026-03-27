const mongoose = require('mongoose');
const {
  SEGMENTS,
  GRAND_INDEX,
  GRAND_PRIZE_MAX_RATIO,
} = require('../constants');

const N = SEGMENTS.length;

const defaultWeights = () => {
  const w = new Array(N).fill(0);
  const total = 10000;
  const grand = 50;
  const rest = total - grand;
  const each = Math.floor(rest / (N - 1));
  for (let i = 0; i < N - 1; i += 1) w[i] = each;
  w[N - 1] = grand;
  let s = w.reduce((a, b) => a + b, 0);
  w[0] += total - s;
  return w;
};

const appConfigSchema = new mongoose.Schema({
  segmentWeights: {
    type: [Number],
    validate: (v) => Array.isArray(v) && v.length === N && v.every((x) => x >= 0),
    default: defaultWeights,
  },
  segmentEnabled: {
    type: [Boolean],
    default: () => new Array(N).fill(true),
  },
});

appConfigSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({
      segmentWeights: defaultWeights(),
      segmentEnabled: new Array(N).fill(true),
    });
  }
  if (!doc.segmentWeights || doc.segmentWeights.length !== N) {
    doc.segmentWeights = defaultWeights();
  }
  if (!doc.segmentEnabled || doc.segmentEnabled.length !== N) {
    doc.segmentEnabled = new Array(N).fill(true);
  }
  await doc.save();
  return doc;
};

/**
 * @param {number[]} weights
 * @param {boolean[]} enabled
 */
function validateGrandCap(weights, enabled) {
  const eff = weights.map((w, i) => (enabled[i] ? w : 0));
  const sum = eff.reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ok: false, error: 'At least one segment must be enabled with positive weight.' };
  const grandW = eff[GRAND_INDEX];
  const ratio = grandW / sum;
  if (ratio >= GRAND_PRIZE_MAX_RATIO) {
    return {
      ok: false,
      error: `Grand prize probability must stay strictly below ${GRAND_PRIZE_MAX_RATIO * 100}%.`,
    };
  }
  return { ok: true };
}

module.exports = mongoose.model('AppConfig', appConfigSchema);
module.exports.validateGrandCap = validateGrandCap;
module.exports.defaultWeights = defaultWeights;
