/**
 * 404 handler for unknown routes.
 */
function notFoundHandler(_req, res, _next) {
  res.status(404).json({ message: 'Not found' });
}

/**
 * Centralized error handler.
 * Ensures we do not leak stack traces in production and keeps
 * memory usage stable by not attaching large objects to errors.
 */
function errorHandler(err, _req, res, _next) { // eslint-disable-line no-unused-vars
  // Log a concise error; in production you might integrate with a logging system
  console.error('Unhandled error:', err && err.stack ? err.stack : err);

  const status = err.statusCode || err.status || 500;

  const payload = {
    message: err.expose ? err.message : 'Internal server error',
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.error = err.message;
  }

  res.status(status).json(payload);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
