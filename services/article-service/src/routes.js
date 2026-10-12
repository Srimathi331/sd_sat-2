const router = require('express').Router();
const { ObjectId } = require('mongodb');
const { asyncHandler, authenticate, optionalAuth, requireRole, internalOnly, validate, notFound, badRequest,
        cacheAside, invalidate, publish, TOPICS } = require('@news/common');
const { articles } = require('./db');

const summary = (a) => ({ id: String(a._id), title: a.title, summary: a.summary, imageUrl: a.imageUrl, source: a.source,
  topics: a.topics, isBreaking: a.isBreaking, publishedAt: a.publishedAt });
const oid = (id) => { try { return new ObjectId(id); } catch { throw badRequest('Invalid article id'); } };

// POST /articles   (editor / ingestion pipeline)  -> emits article.published (+ news.breaking)
router.post('/articles', authenticate, requireRole('editor', 'admin'), asyncHandler(async (req, res) => {
  const b = validate(req.body, { title: { type: 'string', required: true, max: 300 }, summary: { type: 'string', required: true },
    body: { type: 'string', required: true }, topics: { type: 'array', required: true, min: 1 } });
  const doc = { ...b, source: req.body.source || 'newsroom', imageUrl: req.body.imageUrl, language: req.body.language || 'en',
    isBreaking: !!req.body.isBreaking, status: 'published', publishedAt: new Date(), createdAt: new Date() };
  const { insertedId } = await articles().insertOne(doc);
  const event = { ...summary({ ...doc, _id: insertedId }) };

  // Key = first topic => all events of a topic stay ordered on one partition.
  await publish(TOPICS.ARTICLE_PUBLISHED, doc.topics[0], event);
  if (doc.isBreaking) await publish(TOPICS.BREAKING_NEWS, doc.topics[0], event);   // separate high-priority stream
  res.status(201).json(event);
}));

// PUT /articles/:id   (editorial update -> topic.updated + cache invalidation)
router.put('/articles/:id', authenticate, requireRole('editor', 'admin'), asyncHandler(async (req, res) => {
  const { title, summary: s, body, topics } = req.body;
  const upd = await articles().findOneAndUpdate({ _id: oid(req.params.id) },
    { $set: { ...(title && { title }), ...(s && { summary: s }), ...(body && { body }), ...(topics && { topics }), updatedAt: new Date() } }, { returnDocument: 'after' });
  if (!upd) throw notFound('Article not found');
  await invalidate(`article:${req.params.id}`);
  await publish(TOPICS.TOPIC_UPDATED, upd.topics[0], { articleId: req.params.id, topics: upd.topics, action: 'article_updated' });
  res.json(summary(upd));
}));

// GET /articles/:id   (read-through cache; emits a "view" interaction)
router.get('/articles/:id', optionalAuth, asyncHandler(async (req, res) => {
  const article = await cacheAside(`article:${req.params.id}`, 300, async () => {
    const a = await articles().findOne({ _id: oid(req.params.id), status: 'published' });
    return a && { ...summary(a), body: a.body, author: a.author, language: a.language };
  });
  if (!article) throw notFound('Article not found');
  publish(TOPICS.INTERACTION, req.params.id, { type: 'view', articleId: req.params.id, topics: article.topics, userId: req.user?.id || null })
    .catch(() => {});   // fire-and-forget: analytics must never slow down or break reading
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120').json(article);
}));

// GET /articles?topicId=3&limit=20&before=<ISO date>   (keyset pagination - no slow OFFSET)
router.get('/articles', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const q = { status: 'published' };
  if (req.query.topicId) q.topics = Number(req.query.topicId);
  if (req.query.before) q.publishedAt = { $lt: new Date(req.query.before) };
  const key = `articles:list:${req.query.topicId || 'all'}:${req.query.before || 'head'}:${limit}`;
  const items = await cacheAside(key, 20, async () => (await articles().find(q).sort({ publishedAt: -1 }).limit(limit).toArray()).map(summary));
  res.json({ items, nextCursor: items.length === limit ? items[items.length - 1].publishedAt : null });
}));

// POST /articles/:id/interactions  { type: like|share|bookmark|view }  -> user.interaction event
router.post('/articles/:id/interactions', authenticate, asyncHandler(async (req, res) => {
  const { type } = validate(req.body, { type: { type: 'string', required: true, enum: ['view', 'like', 'share', 'bookmark'] } });
  const a = await articles().findOne({ _id: oid(req.params.id) }, { projection: { topics: 1 } });
  if (!a) throw notFound('Article not found');
  await publish(TOPICS.INTERACTION, req.params.id, { type, articleId: req.params.id, topics: a.topics, userId: req.user.id, dwellMs: req.body.dwellMs });
  res.status(202).json({ accepted: true });        // 202: processed asynchronously
}));

// ---- Internal ----
router.post('/internal/articles/batch', internalOnly, asyncHandler(async (req, res) => {
  const ids = (req.body.ids || []).slice(0, 100).map(oid);
  res.json((await articles().find({ _id: { $in: ids } }).toArray()).map(summary));
}));

module.exports = router;
