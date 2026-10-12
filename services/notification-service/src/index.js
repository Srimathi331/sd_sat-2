const { createApp, finalize, listen, env } = require('@news/common');
const store = require('./store');
const realtime = require('./realtime');
const { startConsumers } = require('./consumers');

const app = createApp({ name: 'notification-service' });
app.use(require('./routes'));
finalize(app);

(async () => {
  await store.connect();
  realtime.startSubscriber();
  await startConsumers();
  listen(app, Number(env('PORT', 4005)), store.close);
})();
