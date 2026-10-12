const express = require('express');
const helmet = require('helmet');
const logger = require('./logger');
const { errorHandler, notFound } = require('./errors');

/** Standard Express app: security headers, JSON body, access log, health probes. */
function createApp({ name, readiness = async () => true }) {
  process.env.SERVICE_NAME = name;
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => logger.info('request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }));
    next();
  });
  app.get('/health', (req, res) => res.json({ status: 'ok', service: name })); // liveness probe
  app.get('/ready', async (req, res) => {                                       // readiness probe
    try { await readiness(); res.json({ status: 'ready' }); } catch (e) { res.status(503).json({ status: 'not-ready', reason: e.message }); }
  });
  return app;
}

/** Mount routes, then 404 + error handler (call last). */
function finalize(app) {
  app.use((req, res, next) => next(notFound(`Route ${req.method} ${req.path} not found`)));
  app.use(errorHandler);
}

/** Start the HTTP server with graceful shutdown (important for rolling deploys / autoscaling). */
function listen(app, port, onShutdown = async () => {}) {
  const server = app.listen(port, () => logger.info(`listening on :${port}`));
  const stop = async () => {
    logger.info('shutting down');
    server.close(async () => { await onShutdown().catch(() => {}); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return server;
}

module.exports = { createApp, finalize, listen };
