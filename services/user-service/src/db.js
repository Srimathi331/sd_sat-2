const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { env } = require('@news/common');

const pool = new Pool({
  host: env('POSTGRES_HOST', 'localhost'),
  user: env('POSTGRES_USER', 'news'),
  password: env('POSTGRES_PASSWORD', 'news'),
  database: 'users_db',
  max: 20,                       // pool size per instance; scale pods, not this number
  idleTimeoutMillis: 30000,
});
// For read scaling, add a second Pool pointed at a read replica and route SELECTs to it.

const migrate = () => pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
module.exports = { pool, migrate };
