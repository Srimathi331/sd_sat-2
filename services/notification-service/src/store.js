const { MongoClient, ObjectId } = require('mongodb');
const { env } = require('@news/common');

const client = new MongoClient(env('MONGO_URL', 'mongodb://localhost:27017'), { maxPoolSize: 30 });
let col;
async function connect() {
  await client.connect();
  col = client.db('notifications_db').collection('notifications');
  await col.createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: 'inbox' },
    { key: { createdAt: 1 }, expireAfterSeconds: 30 * 24 * 3600, name: 'ttl_30d' },
  ]);
}
const insertMany = (docs) => (docs.length ? col.insertMany(docs, { ordered: false }) : null);
const inbox = (userId, limit = 30) => col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
const markRead = (userId, id) => col.updateOne({ _id: new ObjectId(id), userId }, { $set: { read: true } });
module.exports = { connect, insertMany, inbox, markRead, close: () => client.close() };
