/**
 * Normalize and validate Instagram username (server-side).
 * @param {string} raw
 * @returns {{ ok: true, username: string } | { ok: false, error: string }}
 */
function normalizeAndValidateUsername(raw) {
  if (raw == null || typeof raw !== 'string') {
    return { ok: false, error: 'Username is required.' };
  }
  let u = raw.trim();
  if (u.startsWith('@')) u = u.slice(1);
  u = u.toLowerCase();

  if (u.length < 1 || u.length > 30) {
    return { ok: false, error: 'Username must be 1–30 characters.' };
  }

  if (!/^[a-z0-9._]+$/.test(u)) {
    return {
      ok: false,
      error:
        'Use only letters, numbers, periods, and underscores (Instagram format).',
    };
  }

  if (u.startsWith('.') || u.endsWith('.') || u.includes('..')) {
    return { ok: false, error: 'Invalid username format.' };
  }

  return { ok: true, username: u };
}

module.exports = { normalizeAndValidateUsername };
