const crypto = require('crypto');
const express = require('express');

const router = express.Router();

function nextUtcMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next;
}

function secondsUntil(date) {
  return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
}

function dailySeed() {
  const d = new Date();
  const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const salt = process.env.ADMIN_TOKEN || 'spin-wheel';
  return crypto.createHash('sha256').update(`${day}:${salt}`).digest();
}

/** Bounded fake pool — changes once per UTC day. */
router.get('/urgency', (_req, res) => {
  const buf = dailySeed();
  const rewardsLeft = 7 + (buf[0] % 36);
  const midnight = nextUtcMidnight();
  const secs = secondsUntil(midnight);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  res.json({
    rewardsLeftToday: rewardsLeft,
    nextResetSeconds: secs,
    nextResetFormatted: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
  });
});

module.exports = router;
