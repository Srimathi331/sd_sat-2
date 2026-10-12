const jwt = require('jsonwebtoken');
const { env } = require('./config');
const { unauthorized, forbidden } = require('./errors');

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env('JWT_SECRET', 'dev-secret'), { expiresIn: '1h' });

/** Verifies the Bearer JWT and attaches req.user = { id, role }. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.access_token; // query token for SSE
  if (!token) return next(unauthorized('Missing token'));
  try {
    const payload = jwt.verify(token, env('JWT_SECRET', 'dev-secret'));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

/** Optional auth: attaches req.user if a valid token exists, never fails. */
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, () => next());
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden('Insufficient role'));

/** Service-to-service guard for /internal/* endpoints. */
function internalOnly(req, res, next) {
  if (req.headers['x-internal-token'] !== env('INTERNAL_TOKEN', 'dev-internal')) return next(forbidden());
  next();
}

module.exports = { signToken, authenticate, optionalAuth, requireRole, internalOnly };
