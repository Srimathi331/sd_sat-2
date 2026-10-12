const test = require('node:test');
const assert = require('node:assert');
const { rank, recency } = require('../src/ranking');

test('recency halves every 3 hours', () => {
  const now = Date.now();
  assert.ok(Math.abs(recency(new Date(now - 3 * 3.6e6), now) - 0.5) < 1e-6);
});

test('followed-topic and fresher article ranks first', () => {
  const now = Date.now();
  const articles = [
    { id: 'old', topics: [9], publishedAt: new Date(now - 10 * 3.6e6) },
    { id: 'fresh', topics: [1], publishedAt: new Date(now - 0.2 * 3.6e6) },
  ];
  const ranked = rank(articles, { followed: new Set([1]), now });
  assert.strictEqual(ranked[0].id, 'fresh');
});

test('breaking news gets a boost', () => {
  const now = Date.now();
  const t = new Date(now - 1 * 3.6e6);
  const ranked = rank([{ id: 'a', topics: [1], publishedAt: t }, { id: 'b', topics: [1], publishedAt: t, isBreaking: true }], { followed: new Set([1]), now });
  assert.strictEqual(ranked[0].id, 'b');
});
