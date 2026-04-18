// src/middleware/error.js
const { validationResult } = require("express-validator");
const logger = require("../utils/logger");

/**
 * Run express-validator checks and return 422 on failure.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: "Validation failed",
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

/**
 * 404 handler — must be registered after all routes.
 */
const notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};

/**
 * Global error handler — must be the last middleware.
 */
const errorHandler = (err, req, res, next) => {
  logger.error(`[${req.method}] ${req.path} — ${err.message}`);
  if (err.stack) logger.error(err.stack);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(422).json({
      error: "Database validation failed",
      details: Object.values(err.errors).map(e => ({ field: e.path, message: e.message })),
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") return res.status(401).json({ error: "Invalid token" });
  if (err.name === "TokenExpiredError")  return res.status(401).json({ error: "Token expired"  });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = { validate, notFound, errorHandler };
