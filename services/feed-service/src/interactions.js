const { MongoClient } = require('mongodb');
const { env } = require('@news/common');

const client = new MongoClient(env('MONGO_URL', 'mongodb://localhost:27017'), { maxPoolSize: 30 });
let col;

/** Interactions are write-heavy & append-only -> own collection (own DB cluster in prod; Cassandra/ClickHouse at extreme scale). */
async function connect() {
  await client.connect();
  col = client.db('interactions_db').collection('interactions');
  await col.createIndexes([
    { key: { userId: 1, type: 1, at: -1 }, name: 'user_history' },        // "my bookmarks", "recently read"
    { key: { articleId: 1, at: -1 }, name: 'article_events' },
    { key: { at: 1 }, expireAfterSeconds: 90 * 24 * 3600, name: 'ttl_90d' }, // raw events auto-expire
  ]);
}
const save = (e) => col.insertOne({ ...e, at: new Date() });
const history = (userId, type, limit = 50) => col.find({ userId, type }).sort({ at: -1 }).limit(limit).toArray();
const recentTopicAffinity = async (userId) => col.aggregate([
  { $match: { userId, at: { $gt: new Date(Date.now() - 7 * 864e5) } } }, { $unwind: '$topics' },
  { $group: { _id: '$topics', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }]).toArray();

module.exports = { connect, save, history, recentTopicAffinity, close: () => client.close() };
