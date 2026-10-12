const { MongoClient } = require('mongodb');
const { env } = require('@news/common');

const client = new MongoClient(env('MONGO_URL', 'mongodb://localhost:27017'), { maxPoolSize: 50, readPreference: 'secondaryPreferred' });
let db;

async function connect() {
  await client.connect();
  db = client.db('articles_db');
  const articles = db.collection('articles');
  await articles.createIndexes([
    { key: { topics: 1, publishedAt: -1 }, name: 'topic_recent' },   // topic feed + pagination
    { key: { publishedAt: -1 }, name: 'recent' },
    { key: { isBreaking: 1, publishedAt: -1 }, name: 'breaking' },
    { key: { title: 'text', summary: 'text' }, name: 'search' },
    { key: { sourceUrl: 1 }, unique: true, sparse: true, name: 'dedupe_source' }, // idempotent ingestion
  ]);
  return db;
}
// Scale-out: shard `articles` on { topics, publishedAt } or hashed _id; keep reads on secondaries.
const articles = () => db.collection('articles');
module.exports = { connect, articles, close: () => client.close() };
