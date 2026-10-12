const { createApp, finalize, listen, env, getRedis } = require('@news/common');
const interactions = require('./interactions');
const { startConsumers } = require('./consumers');

const app = createApp({ name: 'feed-service', readiness: () => getRedis().ping() });
app.use(require('./routes'));
finalize(app);

(async () => {
  await interactions.connect();
  await startConsumers();
  listen(app, Number(env('PORT', 4004)), interactions.close);
})();
