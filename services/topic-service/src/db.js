const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { env } = require('@news/common');

const pool = new Pool({ host: env('POSTGRES_HOST', 'localhost'), user: env('POSTGRES_USER', 'news'),
  password: env('POSTGRES_PASSWORD', 'news'), database: 'topics_db', max: 20 });
const migrate = () => pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
module.exports = { pool, migrate };
