/**
 * Vercel serverless entry: all traffic is rewritten here (see vercel.json).
 * Env vars are injected by Vercel; dotenv is optional for local `vercel dev`.
 */
try {
  require('dotenv').config();
} catch {
  /* optional */
}

module.exports = require('../server/app');
