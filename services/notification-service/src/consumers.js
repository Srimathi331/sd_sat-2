const { subscribe, TOPICS } = require('@news/common');
const { fanOut } = require('./fanout');
const { deliver } = require('./delivery');

async function startConsumers() {
  // Stage 1: breaking news -> high-priority fan-out (own consumer group so it is never starved by low-priority traffic)
  await subscribe('notification.fanout.breaking', [TOPICS.BREAKING_NEWS], ({ payload }) => fanOut(payload, 'breaking'));

  // Stage 1 (low priority): normal new articles -> in-app inbox only
  await subscribe('notification.fanout.topic', [TOPICS.ARTICLE_PUBLISHED], ({ payload }) => (payload.isBreaking ? null : fanOut(payload, 'normal')));

  // Stage 2: delivery workers - scale by adding pods (up to #partitions)
  await subscribe('notification.delivery', [TOPICS.NOTIFICATION_REQUESTED], ({ payload }) => deliver(payload));
}
module.exports = { startConsumers };
