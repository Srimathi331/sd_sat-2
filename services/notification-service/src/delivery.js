const { createServiceClient, env, logger } = require('@news/common');
const providers = require('./providers');
const store = require('./store');
const realtime = require('./realtime');

const userClient = createServiceClient(env('USER_SERVICE_URL', 'http://localhost:4001'));

function inQuietHours(quiet, now = new Date()) {
  if (!quiet?.from || !quiet?.to) return false;
  const hhmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: quiet.tz || 'UTC' });
  return quiet.from > quiet.to ? hhmm >= quiet.from || hhmm < quiet.to : hhmm >= quiet.from && hhmm < quiet.to;
}

/**
 * STAGE 2 - Delivery.  Consumes a batch of <=500 users, looks up their preferences in ONE call,
 * then sends through each enabled channel in bulk.
 */
async function deliver({ userIds, article, priority }) {
  const profiles = await userClient.post('/internal/users/delivery-profiles', { userIds });
  const pushMsgs = [], emailMsgs = [], inboxDocs = [];
  const title = priority === 'breaking' ? `BREAKING: ${article.title}` : article.title;

  for (const p of profiles) {
    if (priority === 'breaking' && !p.breaking_news) continue;               // user opted out
    const ch = p.channels || {};
    const quiet = inQuietHours(p.quiet_hours) && priority !== 'breaking';    // breaking news may bypass quiet hours
    if (ch.push && !quiet && priority === 'breaking') for (const token of p.device_tokens) pushMsgs.push({ token, title, body: article.summary, data: { articleId: article.id } });
    if (ch.email && priority === 'breaking') emailMsgs.push({ to: p.email, subject: title, html: `<p>${article.summary}</p>` });
    if (ch.inApp !== false) inboxDocs.push({ userId: p.user_id, articleId: article.id, title, summary: article.summary, priority, read: false, createdAt: new Date() });
  }

  await Promise.allSettled([
    providers.push.sendBatch(pushMsgs),
    providers.email.sendBatch(emailMsgs),
    store.insertMany(inboxDocs),
  ]);
  await Promise.allSettled(inboxDocs.map((d) => realtime.pushToUser(d.userId, { title: d.title, summary: d.summary, articleId: d.articleId, priority })));
  logger.info('delivered', { users: profiles.length, push: pushMsgs.length, email: emailMsgs.length, inApp: inboxDocs.length });
}
module.exports = { deliver, inQuietHours };
