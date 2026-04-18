// src/utils/logger.js
const { createLogger, format, transports } = require("winston");

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.colorize(),
    format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `${timestamp} [${level}] ${message}\n${stack}`
        : `${timestamp} [${level}] ${message}`
    )
  ),
  transports: [new transports.Console()],
});

if (process.env.NODE_ENV === "production") {
  logger.add(new transports.File({ filename: "logs/error.log", level: "error" }));
  logger.add(new transports.File({ filename: "logs/combined.log" }));
}

module.exports = logger;
