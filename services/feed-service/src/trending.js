const { getRedis, cacheAside } = require('@news/common');

/**
 * Trending = sliding window over 5-minute buckets stored as Redis sorted sets.
 *   trend:<scope>:<bucketStart>   member = articleId, score = weighted interactions
 * Query = ZUNIONSTORE of the last N buckets with newer buckets weighted higher.
 * Buckets expire by TTL, so there is no cleanup job.
 */
const BUCKET_SECONDS = 300;
const WEIGHTS = { view: 1, like: 3, bookmark: 4, share: 5 };
const WINDOWS = { '1h': 12, '6h': 72, '24h': 288 };

const bucketOf = (ms = Date.now()) => Math.floor(ms / 1000 / BUCKET_SECONDS) * BUCKET_SECONDS;
const key = (scope, bucket) => `trend:${scope}:${bucket}`;

/** Called by the interaction consumer for every event. */
async function record({ type, articleId, topics = [] }) {
  const w = WEIGHTS[type];
  if (!w) return;
  const bucket = bucketOf();
  const pipe = getRedis().pipeline();
  for (const scope of ['global', ...topics.map((t) => `topic:${t}`)]) {
    pipe.zincrby(key(scope, bucket), w, articleId);
    pipe.expire(key(scope, bucket), 25 * 3600);
  }
  await pipe.exec();
}

async function compute(scope, window, limit) {
  const redis = getRedis();
  const n = WINDOWS[window];
  const now = bucketOf();
  const keys = [], weights = [];
  for (let i = 0; i < n; i++) { keys.push(key(scope, now - i * BUCKET_SECONDS)); weights.push(1 / (1 + i / 12)); } // recent buckets count more
  const tmp = `tmp:trend:${scope}:${window}:${process.pid}`;
  await redis.zunionstore(tmp, keys.length, ...keys, 'WEIGHTS', ...weights);
  const flat = await redis.zrevrange(tmp, 0, limit - 1, 'WITHSCORES');
  await redis.del(tmp);
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ articleId: flat[i], score: Number(flat[i + 1]) });
  return out;
}

/** Cached for 15s: thousands of clients asking for "trending" cost ONE computation per 15s per scope. */
const getTrending = ({ topicId, window = '1h', limit = 20 }) =>
  cacheAside(`trending:${topicId ? `topic:${topicId}` : 'global'}:${window}:${limit}`, 15,
    () => compute(topicId ? `topic:${topicId}` : 'global', window, limit));

/** Popularity lookup for ranking (global 1h score). */
async function popularityMap() {
  const list = await getTrending({ window: '1h', limit: 200 });
  return new Map(list.map((t) => [t.articleId, t.score]));
}

module.exports = { record, getTrending, popularityMap, WINDOWS };
