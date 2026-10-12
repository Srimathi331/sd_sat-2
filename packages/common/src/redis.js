const Redis = require('ioredis');
const { env } = require('./config');
const logger = require('./logger');

let client;
/** Singleton Redis client (point REDIS_URL at a Redis Cluster / ElastiCache endpoint in prod). */
function getRedis() {
  if (!client) {
    client = new Redis(env('REDIS_URL', 'redis://localhost:6379'), { maxRetriesPerRequest: 2, enableOfflineQueue: false });
    client.on('error', (e) => logger.warn('redis error', { err: e.message }));
  }
  return client;
}
module.exports = { getRedis };
