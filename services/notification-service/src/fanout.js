const { createServiceClient, publishBatch, getRedis, env, TOPICS } = require('@news/common');

const topicClient = createServiceClient(env('TOPIC_SERVICE_URL', 'http://localhost:4002'));
const BATCH = 500;

/**
 * STAGE 1 - Fan-out.  One breaking-news event  ->  N small "deliver to these 500 users" events.
 *  - walks followers with keyset pagination (never loads millions of rows at once)
 *  - de-duplicates users that follow several topics of the same article (Redis SET NX)
 *  - emits batches on notification.requested, which many delivery workers consume in parallel
 */
async function fanOut(article, priority) {
  const redis = getRedis();
  for (const topicId of article.topics) {
    let after;
    do {
      const page = await topicClient.get(`/internal/topics/${topicId}/followers`, { limit: 5000, after });
      const fresh = [];
      for (const userId of page.userIds) {
        const first = await redis.set(`notif:dedupe:${article.id}:${userId}`, '1', 'EX', 86400, 'NX');
        if (first) fresh.push(userId);
      }
      const batches = [];
      for (let i = 0; i < fresh.length; i += BATCH) {
        batches.push({ key: `${article.id}:${topicId}:${i}`, payload: { userIds: fresh.slice(i, i + BATCH), article, priority } });
      }
      if (batches.length) await publishBatch(TOPICS.NOTIFICATION_REQUESTED, batches);
      after = page.nextCursor;
    } while (after);
  }
}
module.exports = { fanOut };
