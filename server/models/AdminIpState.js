const mongoose = require('mongoose');

/** Tracks failed admin token attempts per IP; permanent block after 2 failures. */
const adminIpStateSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true, index: true },
  failedAttempts: { type: Number, default: 0 },
  blocked: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

adminIpStateSchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AdminIpState', adminIpStateSchema);
