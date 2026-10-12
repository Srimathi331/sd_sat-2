const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createApp, finalize, listen, env, getRedis, authenticate, optionalAuth, logger } = require('@news/common');
const routes = require('./routes');

const app = createApp({ name: 'api-gateway' });
app.set('trust proxy', 1);
app.use(cors({ origin: env('CORS_ORIGIN', '*') }));
app.use(compression({ filter: (req, res) => !req.path.endsWith('/stream') && compression.filter(req, res) })); // never buffer SSE

// Rate limiting shared across all gateway pods via Redis. Protects backends during spikes / abuse.
const limiter = (max, windowMs = 60_000) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args) => getRedis().call(...args) }),
  keyGenerator: (req) => req.headers.authorization?.slice(-24) || req.ip,
  handler: (req, res) => res.status(429).json({ error: { message: 'Too many requests, slow down' } }),
});
app.use('/api/', limiter(Number(env('RATE_LIMIT_PER_MIN', 300))));
app.use('/api/v1/auth', limiter(20));                                         // stricter for login / register

// Internal endpoints must never be reachable from outside.
app.use((req, res, next) => (req.path.includes('/internal/') ? res.status(404).json({ error: { message: 'Not found' } }) : next()));

for (const r of routes) {
  const guard = r.auth === true ? authenticate : r.auth === 'optional' ? optionalAuth : (q, s, n) => n();
  app.use(r.prefix, guard, createProxyMiddleware({
    target: r.target,
    changeOrigin: true,
    proxyTimeout: r.prefix.endsWith('notifications') ? 0 : 5000,       // 0 = unlimited (SSE stream), else fail fast
    pathRewrite: (path, req) => req.originalUrl.replace('/api/v1', ''),
    on: { error: (err, req, res) => { logger.error('upstream error', { path: req.originalUrl, err: err.message }); res.writeHead?.(502, { 'Content-Type': 'application/json' }); res.end?.(JSON.stringify({ error: { message: 'Upstream unavailable' } })); } },
  }));
}

finalize(app);
listen(app, Number(env('PORT', 8080)));
