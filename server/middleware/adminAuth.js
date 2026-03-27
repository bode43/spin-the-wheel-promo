const jwt = require('jsonwebtoken');
const { getClientIp } = require('../utils/clientIp');
const AdminIpState = require('../models/AdminIpState');

const COOKIE = 'spin_admin_jwt';

function adminJwtSecret() {
  const s = process.env.ADMIN_TOKEN;
  if (!s || s.length < 16) {
    throw new Error('ADMIN_TOKEN must be set (min 16 chars) for admin auth.');
  }
  return s;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    jwt.verify(token, adminJwtSecret());
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * @param {import('express').Request} req
 */
async function isAdminIpBlocked(req) {
  const ip = getClientIp(req);
  if (!ip) return false;
  const row = await AdminIpState.findOne({ ip });
  return Boolean(row?.blocked);
}

/**
 * @param {import('express').Request} req
 */
async function recordAdminFailure(req) {
  const ip = getClientIp(req);
  if (!ip) return;
  const row = await AdminIpState.findOneAndUpdate(
    { ip },
    { $inc: { failedAttempts: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  if (row.failedAttempts >= 2) {
    row.blocked = true;
    await row.save();
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function setAdminCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function clearAdminCookie(res) {
  res.clearCookie(COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

module.exports = {
  COOKIE,
  adminJwtSecret,
  requireAdmin,
  isAdminIpBlocked,
  recordAdminFailure,
  setAdminCookie,
  clearAdminCookie,
};
