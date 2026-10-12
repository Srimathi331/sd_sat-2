const { getRedis, createServiceClient, env } = require('@news/common');

const articleClient = createServiceClient(env('ARTICLE_SERVICE_URL', 'http://localhost:4003'));
const SUMMARY_TTL = 24 * 3600;

/** Called by consumers when an article is published: keep a hot copy + per-topic "latest" index in Redis. */
async function indexArticle(a) {
  const pipe = getRedis().pipeline();
  pipe.set(`article:summary:${a.id}`, JSON.stringify(a), 'EX', SUMMARY_TTL);
  const ts = new Date(a.publishedAt).getTime();
  for (const t of a.topics) {
    pipe.zadd(`topic:latest:${t}`, ts, a.id);
    pipe.zremrangebyrank(`topic:latest:${t}`, 0, -501);   // keep newest 500 per topic
  }
  pipe.zadd('latest:global', ts, a.id);
  pipe.zremrangebyrank('latest:global', 0, -1001);
  await pipe.exec();
}

async function latestIds(topicIds, perTopic = 50) {
  const redis = getRedis();
  const pipe = redis.pipeline();
  (topicIds.length ? topicIds.map((t) => `topic:latest:${t}`) : ['latest:global']).forEach((k) => pipe.zrevrange(k, 0, perTopic - 1));
  const results = await pipe.exec();
  return [...new Set(results.flatMap(([, ids]) => ids))];
}

/** Hydrate ids -> summaries: Redis first (MGET), fall back to article-service for misses. */
async function hydrate(ids) {
  if (!ids.length) return [];
  const redis = getRedis();
  const cached = await redis.mget(ids.map((i) => `article:summary:${i}`));
  const byId = new Map();
  const missing = [];
  ids.forEach((id, i) => (cached[i] ? byId.set(id, JSON.parse(cached[i])) : missing.push(id)));
  if (missing.length) {
    const fetched = await articleClient.post('/internal/articles/batch', { ids: missing }).catch(() => []);
    for (const a of fetched) { byId.set(a.id, a); redis.set(`article:summary:${a.id}`, JSON.stringify(a), 'EX', SUMMARY_TTL).catch(() => {}); }
  }
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

module.exports = { indexArticle, latestIds, hydrate };
