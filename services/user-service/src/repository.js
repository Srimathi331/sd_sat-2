const { pool } = require('./db');

const createUser = async ({ email, passwordHash, name }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name, role', [email, passwordHash, name]);
    await client.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [rows[0].id]);
    await client.query('COMMIT');
    return rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

const findByEmail = async (email) => (await pool.query('SELECT * FROM users WHERE email=$1', [email])).rows[0];
const findById = async (id) => (await pool.query('SELECT id,email,name,role,created_at FROM users WHERE id=$1', [id])).rows[0];
const getPreferences = async (userId) => (await pool.query('SELECT * FROM user_preferences WHERE user_id=$1', [userId])).rows[0];

const updatePreferences = async (userId, { languages, breakingNews, channels, quietHours }) =>
  (await pool.query(
    `UPDATE user_preferences SET
       languages = COALESCE($2, languages), breaking_news = COALESCE($3, breaking_news),
       channels = COALESCE($4, channels), quiet_hours = COALESCE($5, quiet_hours), updated_at = now()
     WHERE user_id=$1 RETURNING *`,
    [userId, languages, breakingNews, channels ? JSON.stringify(channels) : null, quietHours ? JSON.stringify(quietHours) : null])).rows[0];

const addDevice = (userId, token, platform) =>
  pool.query('INSERT INTO device_tokens (user_id, token, platform) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, token, platform]);

/** Bulk lookup used by the notification fan-out (prefs + device tokens for up to ~500 users). */
const getDeliveryProfiles = async (userIds) =>
  (await pool.query(
    `SELECT p.user_id, p.channels, p.breaking_news, p.quiet_hours, u.email,
            COALESCE(json_agg(d.token) FILTER (WHERE d.token IS NOT NULL), '[]') AS device_tokens
       FROM user_preferences p JOIN users u ON u.id = p.user_id
       LEFT JOIN device_tokens d ON d.user_id = p.user_id
      WHERE p.user_id = ANY($1::uuid[]) GROUP BY p.user_id, u.email`, [userIds])).rows;

module.exports = { createUser, findByEmail, findById, getPreferences, updatePreferences, addDevice, getDeliveryProfiles };
