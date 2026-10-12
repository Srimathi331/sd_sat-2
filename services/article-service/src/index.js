const { createApp, finalize, listen, env, ensureTopics, logger } = require('@news/common');
const { connect, close } = require('./db');

const app = createApp({ name: 'article-service' });
app.use(require('./routes'));
finalize(app);

(async () => {
  await connect();
  await ensureTopics().catch((e) => logger.warn('ensureTopics skipped', { err: e.message }));
  listen(app, Number(env('PORT', 4003)), close);
})();
