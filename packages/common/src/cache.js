const { getRedis } = require('./redis');

const jitter = (ttl) => Math.floor(ttl * (0.9 + Math.random() * 0.2)); // +-10% avoids synchronized expiry
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Cache-aside with:
 *  - TTL jitter            -> prevents "cache avalanche"
 *  - short lock (SET NX)   -> prevents "cache stampede" on hot keys (breaking news!)
 *  - negative caching      -> prevents "cache penetration" for missing ids
 *  - fail-open             -> if Redis is down we fall back to the database
 */
async function cacheAside(key, ttlSeconds, loader, { lockSeconds = 5 } = {}) {
  const redis = getRedis();
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);

    const lockKey = `lock:${key}`;
    const gotLock = await redis.set(lockKey, '1', 'EX', lockSeconds, 'NX');
    if (!gotLock) {
      // Another request is already loading this key; wait briefly and re-check.
      for (let i = 0; i < 5; i++) {
        await sleep(50);
        const retry = await redis.get(key);
        if (retry !== null) return JSON.parse(retry);
      }
    }
    try {
      const value = await loader();
      await redis.set(key, JSON.stringify(value ?? null), 'EX', jitter(value == null ? 30 : ttlSeconds));
      return value;
    } finally {
      if (gotLock) await redis.del(lockKey);
    }
  } catch (err) {
    if (err.name === 'SyntaxError' || /Stream isn't writeable|Connection is closed/.test(err.message)) return loader();
    throw err;
  }
}

const invalidate = (...keys) => getRedis().del(...keys).catch(() => {});

module.exports = { cacheAside, invalidate };
