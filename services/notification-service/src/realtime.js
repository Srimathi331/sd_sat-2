const Redis = require('ioredis');
const { getRedis, env } = require('@news/common');

/**
 * In-app real-time delivery with Server-Sent Events.
 * Any instance can publish to Redis channel notify:<userId>; the instance that holds that user's
 * SSE connection forwards it. This makes the SSE tier horizontally scalable.
 */
const connections = new Map();   // userId -> Set<res>
let sub;

function startSubscriber() {
  sub = new Redis(env('REDIS_URL', 'redis://localhost:6379'));
  sub.psubscribe('notify:*');
  sub.on('pmessage', (_p, channel, message) => {
    const userId = channel.slice('notify:'.length);
    for (const res of connections.get(userId) || []) res.write(`event: notification\ndata: ${message}\n\n`);
  });
}

function addConnection(userId, res) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);   // keep proxies from closing idle streams
  res.on('close', () => { clearInterval(ping); connections.get(userId)?.delete(res); });
}

const pushToUser = (userId, payload) => getRedis().publish(`notify:${userId}`, JSON.stringify(payload));
module.exports = { startSubscriber, addConnection, pushToUser };
