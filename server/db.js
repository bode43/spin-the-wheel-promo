const mongoose = require('mongoose');

/** Reused across hot serverless invocations (Vercel). */
function getCache() {
  if (!global.__spinWheelMongo) {
    global.__spinWheelMongo = { conn: null, promise: null, memoryServer: null };
  }
  return global.__spinWheelMongo;
}

/**
 * Connect once per instance; safe for Vercel serverless when cached.
 * @returns {Promise<import('mongoose').Connection>}
 */
async function connectMongo() {
  const uriRaw = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spinwheel_promo').trim();

  if (uriRaw === 'memory' && process.env.VERCEL) {
    throw new Error(
      'MONGODB_URI=memory is not supported on Vercel. Use MongoDB Atlas and set MONGODB_URI in Project Settings → Environment Variables.'
    );
  }

  const cache = getCache();
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    let uri = uriRaw;

    if (uri === 'memory') {
      let MongoMemoryServer;
      try {
        ({ MongoMemoryServer } = require('mongodb-memory-server'));
      } catch {
        throw new Error(
          'MONGODB_URI=memory requires devDependency mongodb-memory-server. Run npm install (not --omit=dev), or set a real MONGODB_URI.'
        );
      }
      if (!cache.memoryServer) {
        cache.memoryServer = await MongoMemoryServer.create();
      }
      uri = cache.memoryServer.getUri();
      const db = 'spinwheel_promo';
      uri = uri.endsWith('/') ? `${uri}${db}` : `${uri}/${db}`;
    }

    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: uriRaw === 'memory' ? 30_000 : 20_000,
    };

    cache.promise = mongoose.connect(uri, opts).then(() => mongoose.connection);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    cache.conn = null;
    throw err;
  }

  return cache.conn;
}

module.exports = { connectMongo };
