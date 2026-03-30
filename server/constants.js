/** Canonical segment definitions — labels only; probabilities live in DB. */
exports.SEGMENTS = [
  { key: 'discount_30', label: '30% discount' },
  { key: 'discount_40', label: '40% discount' },
  { key: 'gift_800', label: 'Free gift worth 800' },
  { key: 'gift_1600', label: 'Free gift worth 1,600' },
  { key: 'gift_2400', label: 'Free gift worth 2,400' },
  {
    key: 'grand_8000',
    label: 'Grand prize: free order worth 8,000 (Ultra rare)',
    /** Wheel shows two lines; modal and DB use `label`. */
    labelLines: ['Grand prize: free order worth 8,000', '(Ultra rare)'],
  },
];

exports.GRAND_INDEX = 5;
/** Hard cap: grand weight / total must be strictly < this (below 1%). */
exports.GRAND_PRIZE_MAX_RATIO = 0.01;

exports.SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
