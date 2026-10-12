const { subscribe, TOPICS, invalidate, logger } = require('@news/common');
const { indexArticle } = require('./articleStore');
const trending = require('./trending');
const interactions = require('./interactions');

async function startConsumers() {
  // 1) New / breaking articles -> update hot indexes in Redis (so feeds never hit the DB for fresh news)
  await subscribe('feed-service.articles', [TOPICS.ARTICLE_PUBLISHED, TOPICS.BREAKING_NEWS], async ({ payload }) => {
    await indexArticle(payload);
  });

  // 2) Topic / article updates -> drop stale cached summaries
  await subscribe('feed-service.topic-updates', [TOPICS.TOPIC_UPDATED], async ({ payload }) => {
    if (payload.articleId) await invalidate(`article:summary:${payload.articleId}`);
  });

  // 3) Interactions -> persist history + update trending counters
  await subscribe('feed-service.interactions', [TOPICS.INTERACTION], async ({ payload }) => {
    await Promise.all([trending.record(payload), payload.userId ? interactions.save(payload) : null]);
  });
  logger.info('feed-service consumers started');
}
module.exports = { startConsumers };
