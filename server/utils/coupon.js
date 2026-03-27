const crypto = require('crypto');

function generateCouponCode() {
  const buf = crypto.randomBytes(10);
  const base = buf.toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const suffix = crypto.randomInt(1000, 9999);
  return `SW-${base.toUpperCase()}-${suffix}`;
}

module.exports = { generateCouponCode };
