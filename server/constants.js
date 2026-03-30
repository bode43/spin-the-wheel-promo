/** Canonical segment definitions — labels only; probabilities live in DB. */
exports.SEGMENTS = [
  { key: 'discount_30', label: '30% Discount' },
  { key: 'discount_40', label: '40% Discount' },
  { key: 'gift_800', label: 'Free Gift Worth 800' },
  { key: 'gift_1600', label: 'Free Gift Worth 1,600' },
  { key: 'gift_2400', label: 'Free Gift Worth 2,400' },
  { key: 'grand_8000', label: 'Free Order Worth 8,000' },
];

exports.GRAND_INDEX = 5;
/** Hard cap: grand weight / total must be strictly < this (below 1%). */
exports.GRAND_PRIZE_MAX_RATIO = 0.01;

exports.SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
