/** Minimal structured JSON logger (swap for pino/winston in production). */
const base = () => ({ ts: new Date().toISOString(), service: process.env.SERVICE_NAME || 'unknown' });
const log = (level) => (msg, meta = {}) =>
  console.log(JSON.stringify({ level, ...base(), msg, ...meta }));

module.exports = { info: log('info'), warn: log('warn'), error: log('error'), debug: log('debug') };
