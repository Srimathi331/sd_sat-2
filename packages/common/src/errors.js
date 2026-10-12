const logger = require('./logger');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
const badRequest = (m, d) => new HttpError(400, m, d);
const unauthorized = (m = 'Unauthorized') => new HttpError(401, m);
const forbidden = (m = 'Forbidden') => new HttpError(403, m);
const notFound = (m = 'Not found') => new HttpError(404, m);
const conflict = (m = 'Conflict') => new HttpError(409, m);

/** Wrap async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) logger.error(err.message, { stack: err.stack, path: req.path });
  res.status(status).json({ error: { message: status >= 500 ? 'Internal server error' : err.message, details: err.details } });
}

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler, errorHandler };
