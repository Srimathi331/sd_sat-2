/**
 * Personalised ranking.  score = 0.5*recency + 0.3*topicAffinity + 0.2*popularity (+ breaking boost)
 *  - recency:   exponential decay, half-life ~ 3h (news goes stale fast)
 *  - affinity:  fraction of the article's topics the user follows
 *  - popularity: article's trending score, normalised to 0..1
 */
const HALF_LIFE_HOURS = 3;

function recency(publishedAt, now = Date.now()) {
  const ageHours = Math.max(0, (now - new Date(publishedAt).getTime()) / 3.6e6);
  return Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
}

function affinity(articleTopics = [], followed = new Set()) {
  if (!articleTopics.length) return 0;
  return articleTopics.filter((t) => followed.has(t)).length / articleTopics.length;
}

function score(article, { followed, popularity = 0, maxPopularity = 1, now }) {
  const pop = maxPopularity > 0 ? popularity / maxPopularity : 0;
  const base = 0.5 * recency(article.publishedAt, now) + 0.3 * affinity(article.topics, followed) + 0.2 * pop;
  return article.isBreaking ? base + 0.25 * recency(article.publishedAt, now) : base;
}

function rank(articles, ctx) {
  const maxPopularity = Math.max(1, ...articles.map((a) => ctx.popularityOf?.(a.id) ?? 0));
  return articles
    .map((a) => ({ ...a, _score: score(a, { ...ctx, popularity: ctx.popularityOf?.(a.id) ?? 0, maxPopularity }) }))
    .sort((a, b) => b._score - a._score);
}

module.exports = { recency, affinity, score, rank };
