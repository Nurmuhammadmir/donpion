export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Multer (file upload) errors — too large, too many files, wrong field —
  // arrive here without res.statusCode ever being set, so they'd otherwise
  // fall through to a misleading 500.
  const isMulterError = err.name === "MulterError";

  // Mongoose validation/cast errors (a required field missing, a bad
  // ObjectId, a value out of range) are the admin's mistake, not a server
  // fault — surfacing them as 400 with the real per-field message instead
  // of an opaque 500 is what actually makes them fixable from the form.
  let message = err.message;
  let isClientError = isMulterError;

  if (err.name === "ValidationError" && err.errors) {
    isClientError = true;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
  } else if (err.name === "CastError") {
    isClientError = true;
    message = `Invalid value for "${err.path}": ${err.value}`;
  } else if (err.code === 11000) {
    isClientError = true;
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `A record with this ${field} already exists`;
  }

  const statusCode = isClientError ? 400 : res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}
