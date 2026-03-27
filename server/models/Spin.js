const mongoose = require('mongoose');

const spinSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    rewardKey: { type: String, required: true },
    rewardLabel: { type: String, required: true },
    segmentIndex: { type: Number, required: true, min: 0, max: 5 },
    coupon: { type: String, required: true, unique: true, index: true },
    ip: { type: String, required: true, index: true },
    fingerprint: { type: String, default: '' },
    redeemed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

spinSchema.index({ username: 1, createdAt: -1 });
spinSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model('Spin', spinSchema);
