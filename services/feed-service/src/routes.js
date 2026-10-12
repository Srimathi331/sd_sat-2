const router = require('express').Router();
const { asyncHandler, authenticate, optionalAuth, createServiceClient, cacheAside, env, badRequest } = require('@news/common');
const { latestIds, hydrate } = require('./articleStore');
const { rank } = require('./ranking');
const trending = require('./trending');
const interactions = require('./interactions');

const topics = createServiceClient(env('TOPIC_SERVICE_URL', 'http://localhost:4002'));

// GET /feed?limit=20&offset=0   -> personalised, ranked feed
router.get('/feed', authenticate, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;

  // Whole ranked list cached per user for 60s: refreshing the app is cheap, new articles show within a minute.
  const ranked = await cacheAside(`feed:user:${req.user.id}`, 60, async () => {
    const followed = await topics.get(`/internal/users/${req.user.id}/topics`).catch(() => []);   // degrade gracefully
    const ids = await latestIds(followed, 50);
    const [articles, pop] = await Promise.all([hydrate(ids), trending.popularityMap().catch(() => new Map())]);
    return rank(articles, { followed: new Set(followed), popularityOf: (id) => pop.get(id) }).slice(0, 200);
  });
  res.json({ items: ranked.slice(offset, offset + limit), nextOffset: offset + limit < ranked.length ? offset + limit : null });
}));

/**
 * GET /trending?topicId=&window=1h|6h|24h&limit=20      <-- "additional API: Get Trending News"
 * Public endpoint (works for anonymous visitors), CDN-cacheable, backed by Redis sorted sets.
 */
router.get('/trending', optionalAuth, asyncHandler(async (req, res) => {
  const window = req.query.window || '1h';
  if (!trending.WINDOWS[window]) throw badRequest(`window must be one of ${Object.keys(trending.WINDOWS).join(', ')}`);
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const list = await trending.getTrending({ topicId: req.query.topicId, window, limit });
  const articles = await hydrate(list.map((t) => t.articleId));
  const scoreById = new Map(list.map((t) => [t.articleId, t.score]));
  res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60')
     .json({ window, topicId: req.query.topicId ? Number(req.query.topicId) : null, generatedAt: new Date().toISOString(),
             items: articles.map((a, i) => ({ rank: i + 1, trendingScore: scoreById.get(a.id), ...a })) });
}));

// GET /users/me/bookmarks  and /users/me/history
router.get('/users/me/bookmarks', authenticate, asyncHandler(async (req, res) => {
  const rows = await interactions.history(req.user.id, 'bookmark');
  res.json(await hydrate([...new Set(rows.map((r) => r.articleId))]));
}));
router.get('/users/me/history', authenticate, asyncHandler(async (req, res) => {
  const rows = await interactions.history(req.user.id, 'view');
  res.json(await hydrate([...new Set(rows.map((r) => r.articleId))]));
}));

module.exports = router;
