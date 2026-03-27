const express = require('express');
const rateLimit = require('express-rate-limit');
const Spin = require('../models/Spin');
const AppConfig = require('../models/AppConfig');
const { spinOnce } = require('../services/spinEngine');
const { normalizeAndValidateUsername } = require('../utils/instagramUsername');
const { generateCouponCode } = require('../utils/coupon');
const { getClientIp } = require('../utils/clientIp');
const { isWhitelisted, DEFAULT_PATH } = require('../loadWhitelist');
const { SPIN_COOLDOWN_MS } = require('../constants');

const router = express.Router();

const spinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

function validateFingerprint(fp) {
  if (fp == null || fp === '') return { ok: true, value: '' };
  if (typeof fp !== 'string' || fp.length > 128) {
    return { ok: false, error: 'Invalid device fingerprint.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(fp)) {
    return { ok: false, error: 'Invalid device fingerprint.' };
  }
  return { ok: true, value: fp };
}

router.post('/spin', spinLimiter, async (req, res) => {
  const { username: rawUser, fingerprint: rawFp } = req.body || {};
  const userRes = normalizeAndValidateUsername(rawUser);
  if (!userRes.ok) {
    return res.status(400).json({ error: userRes.error });
  }
  const fpRes = validateFingerprint(rawFp);
  if (!fpRes.ok) {
    return res.status(400).json({ error: fpRes.error });
  }

  const whitelistPath = process.env.WHITELIST_PATH || DEFAULT_PATH;
  if (!isWhitelisted(userRes.username, whitelistPath)) {
    return res.status(403).json({
      error:
        'This Instagram account is not eligible to play. Please contact us if you believe this is a mistake.',
    });
  }

  const ip = getClientIp(req);
  if (!ip) {
    return res.status(400).json({ error: 'Could not verify connection. Try again on mobile data or Wi‑Fi.' });
  }

  const since = new Date(Date.now() - SPIN_COOLDOWN_MS);

  const [byUser, byIp] = await Promise.all([
    Spin.findOne({ username: userRes.username, createdAt: { $gte: since } })
      .select('_id')
      .lean(),
    Spin.findOne({ ip, createdAt: { $gte: since } }).select('_id').lean(),
  ]);

  if (byUser) {
    return res.status(429).json({
      error: 'You have already spun in the last 24 hours. Come back tomorrow!',
    });
  }
  if (byIp) {
    return res.status(429).json({
      error: 'A spin was already used from this network in the last 24 hours.',
    });
  }

  if (fpRes.value) {
    const byFp = await Spin.findOne({
      fingerprint: fpRes.value,
      createdAt: { $gte: since },
    })
      .select('_id')
      .lean();
    if (byFp) {
      return res.status(429).json({
        error: 'This device already used a spin in the last 24 hours.',
      });
    }
  }

  const config = await AppConfig.getSingleton();
  let outcome;
  try {
    outcome = spinOnce(config);
  } catch (e) {
    return res.status(503).json({ error: 'Spin temporarily unavailable. Try again shortly.' });
  }

  let coupon = generateCouponCode();
  let saved;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      saved = await Spin.create({
        username: userRes.username,
        rewardKey: outcome.rewardKey,
        rewardLabel: outcome.rewardLabel,
        segmentIndex: outcome.segmentIndex,
        coupon,
        ip,
        fingerprint: fpRes.value || '',
      });
      break;
    } catch (err) {
      if (err?.code === 11000) {
        coupon = generateCouponCode();
      } else {
        return res.status(500).json({ error: 'Could not complete spin. Try again.' });
      }
    }
  }

  if (!saved) {
    return res.status(500).json({ error: 'Could not complete spin. Try again.' });
  }

  res.json({
    segmentIndex: saved.segmentIndex,
    rewardLabel: saved.rewardLabel,
    coupon: saved.coupon,
  });
});

module.exports = router;
