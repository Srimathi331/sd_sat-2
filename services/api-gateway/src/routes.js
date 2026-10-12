/** Route table: public path prefix -> upstream service. Single place to see the whole public API. */
const { env } = require('@news/common');

module.exports = [
  { prefix: '/api/v1/auth',          target: env('USER_SERVICE_URL', 'http://localhost:4001'),         auth: false },
  { prefix: '/api/v1/users/me/topics', target: env('TOPIC_SERVICE_URL', 'http://localhost:4002'),      auth: true  },
  { prefix: '/api/v1/users/me/bookmarks', target: env('FEED_SERVICE_URL', 'http://localhost:4004'),    auth: true  },
  { prefix: '/api/v1/users/me/history',   target: env('FEED_SERVICE_URL', 'http://localhost:4004'),    auth: true  },
  { prefix: '/api/v1/users',         target: env('USER_SERVICE_URL', 'http://localhost:4001'),         auth: true  },
  { prefix: '/api/v1/topics',        target: env('TOPIC_SERVICE_URL', 'http://localhost:4002'),        auth: 'optional' },
  { prefix: '/api/v1/articles',      target: env('ARTICLE_SERVICE_URL', 'http://localhost:4003'),      auth: 'optional' },
  { prefix: '/api/v1/feed',          target: env('FEED_SERVICE_URL', 'http://localhost:4004'),         auth: true  },
  { prefix: '/api/v1/trending',      target: env('FEED_SERVICE_URL', 'http://localhost:4004'),         auth: false },
  { prefix: '/api/v1/notifications', target: env('NOTIFICATION_SERVICE_URL', 'http://localhost:4005'), auth: true  },
];
