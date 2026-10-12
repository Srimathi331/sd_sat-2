const { createApp, finalize, listen, env } = require('@news/common');
const { pool, migrate } = require('./db');

const app = createApp({ name: 'user-service', readiness: () => pool.query('SELECT 1') });
app.use(require('./routes'));
finalize(app);

migrate().then(() => listen(app, Number(env('PORT', 4001)), () => pool.end()));
