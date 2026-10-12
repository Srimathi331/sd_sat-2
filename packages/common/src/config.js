/** Read an env var, optionally with a default. Throws if required and missing. */
function env(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${key}`);
  return value;
}
module.exports = { env };
