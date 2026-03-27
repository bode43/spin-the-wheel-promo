const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const Spin = require('../models/Spin');
const AppConfig = require('../models/AppConfig');
const { SEGMENTS, GRAND_INDEX, GRAND_PRIZE_MAX_RATIO } = require('../constants');
const { validateGrandCap } = require('../models/AppConfig');
const {
  requireAdmin,
  adminJwtSecret,
  isAdminIpBlocked,
  recordAdminFailure,
  setAdminCookie,
  clearAdminCookie,
} = require('../middleware/adminAuth');

const router = express.Router();

const adminLoginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', adminLoginLimiter, async (req, res) => {
  if (await isAdminIpBlocked(req)) {
    return res.status(403).json({ error: 'This IP is blocked from admin access.' });
  }

  const token = req.body?.token;
  if (typeof token !== 'string' || !token.length) {
    await recordAdminFailure(req);
    return res.status(400).json({ error: 'Token required.' });
  }

  let expected;
  try {
    expected = adminJwtSecret();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  if (token !== expected) {
    await recordAdminFailure(req);
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const jwtTok = jwt.sign({ role: 'admin' }, expected, { expiresIn: '12h' });
  setAdminCookie(res, jwtTok);
  return res.json({ ok: true });
});

router.post('/logout', (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

router.get('/spins', requireAdmin, async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
  const skip = Math.max(0, parseInt(String(req.query.skip), 10) || 0);
  const [items, total] = await Promise.all([
    Spin.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Spin.countDocuments(),
  ]);
  res.json({ items, total, limit, skip });
});

router.get('/export.csv', requireAdmin, async (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="spins.csv"');
  const cursor = Spin.find().sort({ createdAt: -1 }).cursor();
  res.write('username,reward,rewardKey,segmentIndex,coupon,timestamp,ip,redeemed\n');
  for await (const doc of cursor) {
    const row = [
      csvEscape(doc.username),
      csvEscape(doc.rewardLabel),
      csvEscape(doc.rewardKey),
      doc.segmentIndex,
      csvEscape(doc.coupon),
      doc.createdAt?.toISOString() || '',
      csvEscape(doc.ip),
      doc.redeemed ? 'yes' : 'no',
    ].join(',');
    res.write(`${row}\n`);
  }
  res.end();
});

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

router.get('/config', requireAdmin, async (_req, res) => {
  const doc = await AppConfig.getSingleton();
  const weights = doc.segmentWeights;
  const enabled = doc.segmentEnabled;
  const total = weights.reduce((a, w, i) => a + (enabled[i] ? w : 0), 0);
  const grandPct = total > 0 ? (weights[GRAND_INDEX] * (enabled[GRAND_INDEX] ? 1 : 0)) / total : 0;
  res.json({
    segments: SEGMENTS.map((s, i) => ({
      index: i,
      key: s.key,
      label: s.label,
      weight: weights[i],
      enabled: enabled[i],
    })),
    grandPrizeProbabilityApprox: grandPct,
    grandPrizeMaxRatio: GRAND_PRIZE_MAX_RATIO,
  });
});

router.put('/config', requireAdmin, async (req, res) => {
  const { segmentWeights, segmentEnabled } = req.body || {};
  if (!Array.isArray(segmentWeights) || segmentWeights.length !== SEGMENTS.length) {
    return res.status(400).json({ error: 'segmentWeights must be an array of 6 non-negative numbers.' });
  }
  if (!Array.isArray(segmentEnabled) || segmentEnabled.length !== SEGMENTS.length) {
    return res.status(400).json({ error: 'segmentEnabled must be an array of 6 booleans.' });
  }
  const w = segmentWeights.map((x) => Math.max(0, Math.floor(Number(x)) || 0));
  const en = segmentEnabled.map((x) => Boolean(x));
  const cap = validateGrandCap(w, en);
  if (!cap.ok) {
    return res.status(400).json({ error: cap.error });
  }
  const doc = await AppConfig.getSingleton();
  doc.segmentWeights = w;
  doc.segmentEnabled = en;
  await doc.save();
  res.json({ ok: true });
});

router.patch('/segments/:index', requireAdmin, async (req, res) => {
  const idx = parseInt(String(req.params.index), 10);
  if (Number.isNaN(idx) || idx < 0 || idx >= SEGMENTS.length) {
    return res.status(400).json({ error: 'Invalid segment index.' });
  }
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled boolean required.' });
  }
  const doc = await AppConfig.getSingleton();
  doc.segmentEnabled[idx] = enabled;
  const cap = validateGrandCap(doc.segmentWeights, doc.segmentEnabled);
  if (!cap.ok) {
    doc.segmentEnabled[idx] = !enabled;
    return res.status(400).json({ error: cap.error });
  }
  await doc.save();
  res.json({ ok: true });
});

router.patch('/coupon/:code/redeem', requireAdmin, async (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Coupon code required.' });
  const doc = await Spin.findOneAndUpdate(
    { coupon: code },
    { $set: { redeemed: true } },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'Coupon not found.' });
  res.json({ ok: true, coupon: doc.coupon, redeemed: doc.redeemed });
});

module.exports = router;
