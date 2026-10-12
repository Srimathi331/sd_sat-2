const router = require('express').Router();
const { asyncHandler, authenticate, requireRole, internalOnly, validate, notFound, cacheAside, invalidate, publish, TOPICS } = require('@news/common');
const { pool } = require('./db');

// GET /topics  (public, heavily cached: changes rarely, read by every client)
router.get('/topics', asyncHandler(async (req, res) => {
  const topics = await cacheAside('topics:all', 3600, async () => (await pool.query('SELECT id, slug, name, parent_id FROM topics ORDER BY name')).rows);
  res.set('Cache-Control', 'public, max-age=300').json(topics);   // CDN / browser cache too
}));

router.get('/topics/:id', asyncHandler(async (req, res) => {
  const t = await cacheAside(`topic:${req.params.id}`, 3600, async () => (await pool.query('SELECT * FROM topics WHERE id=$1', [req.params.id])).rows[0]);
  if (!t) throw notFound('Topic not found');
  res.json(t);
}));

// POST /topics (admin)
router.post('/topics', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { slug, name } = validate(req.body, { slug: { type: 'string', required: true }, name: { type: 'string', required: true } });
  const { rows } = await pool.query('INSERT INTO topics (slug, name, parent_id) VALUES ($1,$2,$3) RETURNING *', [slug, name, req.body.parentId || null]);
  await invalidate('topics:all');
  await publish(TOPICS.TOPIC_UPDATED, rows[0].id, { topicId: rows[0].id, action: 'created' });
  res.status(201).json(rows[0]);
}));

// POST /topics/:id/follow , DELETE /topics/:id/follow
router.post('/topics/:id/follow', authenticate, asyncHandler(async (req, res) => {
  await pool.query('INSERT INTO topic_follows (user_id, topic_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, req.params.id]);
  await invalidate(`follows:${req.user.id}`);
  res.status(204).end();
}));
router.delete('/topics/:id/follow', authenticate, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM topic_follows WHERE user_id=$1 AND topic_id=$2', [req.user.id, req.params.id]);
  await invalidate(`follows:${req.user.id}`);
  res.status(204).end();
}));

async function followedTopicIds(userId) {
  return cacheAside(`follows:${userId}`, 600, async () =>
    (await pool.query('SELECT topic_id FROM topic_follows WHERE user_id=$1', [userId])).rows.map((r) => r.topic_id));
}

// GET /users/me/topics
router.get('/users/me/topics', authenticate, asyncHandler(async (req, res) => res.json(await followedTopicIds(req.user.id))));

// ---- Internal ----
router.get('/internal/users/:id/topics', internalOnly, asyncHandler(async (req, res) => res.json(await followedTopicIds(req.params.id))));

// Keyset-paginated follower list: used by notification fan-out to walk millions of followers safely.
router.get('/internal/topics/:id/followers', internalOnly, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 1000, 5000);
  const after = req.query.after || '00000000-0000-0000-0000-000000000000';
  const { rows } = await pool.query(
    'SELECT user_id FROM topic_follows WHERE topic_id=$1 AND user_id > $2 ORDER BY user_id LIMIT $3', [req.params.id, after, limit]);
  res.json({ userIds: rows.map((r) => r.user_id), nextCursor: rows.length === limit ? rows[rows.length - 1].user_id : null });
}));

module.exports = router;
