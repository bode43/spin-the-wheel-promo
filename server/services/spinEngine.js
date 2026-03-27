const crypto = require('crypto');
const { SEGMENTS } = require('../constants');

/**
 * Cryptographically fair weighted index using uniform random + cumulative weights.
 * @param {number[]} weights effective weights (zeros allowed)
 */
function pickWeightedIndex(weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error('No valid outcomes');
  const r = crypto.randomInt(0, sum);
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return weights.length - 1;
}

/**
 * @param {import('../models/AppConfig')} configDoc mongoose doc
 */
function resolveEffectiveWeights(configDoc) {
  const w = configDoc.segmentWeights;
  const en = configDoc.segmentEnabled;
  return w.map((weight, i) => (en[i] ? Math.max(0, Number(weight) || 0) : 0));
}

/**
 * @param {import('../models/AppConfig')} configDoc
 */
function spinOnce(configDoc) {
  const eff = resolveEffectiveWeights(configDoc);
  const idx = pickWeightedIndex(eff);
  const seg = SEGMENTS[idx];
  return {
    segmentIndex: idx,
    rewardKey: seg.key,
    rewardLabel: seg.label,
  };
}

module.exports = { pickWeightedIndex, resolveEffectiveWeights, spinOnce };
