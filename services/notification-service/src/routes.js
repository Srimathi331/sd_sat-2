const router = require('express').Router();
const { asyncHandler, authenticate } = require('@news/common');
const store = require('./store');
const realtime = require('./realtime');

// GET /notifications  -> in-app inbox
router.get('/notifications', authenticate, asyncHandler(async (req, res) => res.json(await store.inbox(req.user.id))));

// POST /notifications/:id/read
router.post('/notifications/:id/read', authenticate, asyncHandler(async (req, res) => { await store.markRead(req.user.id, req.params.id); res.status(204).end(); }));

// GET /notifications/stream   (Server-Sent Events; browser: new EventSource('/api/v1/notifications/stream?access_token=...'))
router.get('/notifications/stream', authenticate, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  realtime.addConnection(req.user.id, res);
});

module.exports = router;
