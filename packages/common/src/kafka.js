const { Kafka, logLevel, CompressionTypes } = require('kafkajs');
const { randomUUID } = require('crypto');
const { env } = require('./config');
const logger = require('./logger');

/** Central catalogue of event topics (see docs/ARCHITECTURE.md -> Messaging). */
const TOPICS = {
  ARTICLE_PUBLISHED: 'article.published',
  BREAKING_NEWS: 'news.breaking',
  TOPIC_UPDATED: 'topic.updated',
  INTERACTION: 'user.interaction',
  NOTIFICATION_REQUESTED: 'notification.requested',
};

// Partition counts: high-volume topics get more partitions => more parallel consumers.
const TOPIC_CONFIG = [
  { topic: TOPICS.ARTICLE_PUBLISHED, numPartitions: 12 },
  { topic: TOPICS.BREAKING_NEWS, numPartitions: 12 },
  { topic: TOPICS.TOPIC_UPDATED, numPartitions: 6 },
  { topic: TOPICS.INTERACTION, numPartitions: 48 },
  { topic: TOPICS.NOTIFICATION_REQUESTED, numPartitions: 48 },
];

let kafka;
const getKafka = () =>
  (kafka ||= new Kafka({
    clientId: env('SERVICE_NAME', 'news-service'),
    brokers: env('KAFKA_BROKERS', 'localhost:9092').split(','),
    logLevel: logLevel.WARN,
    retry: { retries: 8, initialRetryTime: 300 },
  }));

let producer;
async function getProducer() {
  if (!producer) {
    producer = getKafka().producer({ idempotent: true, maxInFlightRequests: 5 });
    await producer.connect();
  }
  return producer;
}

/** Create topics if missing (run once at startup by the article-service). */
async function ensureTopics() {
  const admin = getKafka().admin();
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: TOPIC_CONFIG.map((t) => ({ ...t, replicationFactor: Number(env('KAFKA_REPLICATION', '1')) })),
  });
  await admin.disconnect();
}

/**
 * Publish an event wrapped in a standard envelope.
 * `key` decides the partition -> events with the same key stay ordered.
 */
async function publish(topic, key, payload) {
  const p = await getProducer();
  const envelope = { eventId: randomUUID(), type: topic, occurredAt: new Date().toISOString(), payload };
  await p.send({
    topic,
    compression: CompressionTypes.GZIP,
    acks: -1,
    messages: [{ key: String(key), value: JSON.stringify(envelope) }],
  });
  return envelope.eventId;
}

async function publishBatch(topic, items /* [{key, payload}] */) {
  const p = await getProducer();
  await p.send({
    topic,
    compression: CompressionTypes.GZIP,
    messages: items.map(({ key, payload }) => ({
      key: String(key),
      value: JSON.stringify({ eventId: randomUUID(), type: topic, occurredAt: new Date().toISOString(), payload }),
    })),
  });
}

/**
 * Subscribe a consumer group to topics. Failed messages are retried, then parked on `<topic>.dlq`
 * so one poison message never blocks a partition.
 */
async function subscribe(groupId, topics, handler, { retries = 3 } = {}) {
  const consumer = getKafka().consumer({ groupId });
  await consumer.connect();
  for (const topic of topics) await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value.toString());
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          return await handler(event, topic);
        } catch (err) {
          logger.warn('consumer handler failed', { topic, attempt, err: err.message });
          if (attempt === retries) {
            const p = await getProducer();
            await p.send({ topic: `${topic}.dlq`, messages: [{ key: message.key, value: message.value }] });
          } else {
            await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
          }
        }
      }
    },
  });
  return consumer;
}

module.exports = { TOPICS, ensureTopics, publish, publishBatch, subscribe };
