const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { connectMongo } = require('./db');
const urgencyRouter = require('./routes/urgency');
const spinRouter = require('./routes/spin');
const adminRouter = require('./routes/admin');

const trustProxy =
  process.env.VERCEL === '1' ||
  process.env.TRUST_PROXY === '1' ||
  process.env.TRUST_PROXY === 'true';

if (trustProxy && process.env.VERCEL !== '1') {
  // eslint-disable-next-line no-console
  console.warn('Trust proxy enabled (use behind reverse proxy only).');
}

const app = express();
app.set('trust proxy', trustProxy ? 1 : false);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));

app.use('/api', async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[spin-wheel] MongoDB:', err.message);
    res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }
});

app.use('/api', urgencyRouter);
app.use('/api', spinRouter);
app.use('/api/admin', adminRouter);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'], maxAge: '1h' }));

module.exports = app;
