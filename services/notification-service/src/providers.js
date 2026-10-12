const { logger } = require('@news/common');

/**
 * Delivery channel adapters. Each takes a batch so provider APIs (FCM multicast / SES bulk) are used efficiently.
 * Replace the bodies with the real SDK calls (firebase-admin, @aws-sdk/client-ses).
 */
const push = {
  name: 'push',
  async sendBatch(messages /* [{token, title, body, data}] */) {
    if (!messages.length) return;
    // await admin.messaging().sendEach(messages.map(m => ({ token: m.token, notification: {title: m.title, body: m.body}, data: m.data })));
    logger.info('push batch sent', { count: messages.length });
  },
};
const email = {
  name: 'email',
  async sendBatch(messages /* [{to, subject, html}] */) {
    if (!messages.length) return;
    // await ses.send(new SendBulkEmailCommand({...}));
    logger.info('email batch sent', { count: messages.length });
  },
};
module.exports = { push, email };
