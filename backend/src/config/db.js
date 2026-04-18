// src/config/db.js
const mongoose = require("mongoose");
const logger   = require("../utils/logger");

const URI = process.env.MONGODB_URI;

if (!URI) {
  console.error("❌ MONGODB_URI is not set in .env");
  process.exit(1);
}

// Atlas-optimised connection options
const OPTIONS = {
  maxPoolSize:              10,
  serverSelectionTimeoutMS: 30000,   // 30s to find a server
  socketTimeoutMS:          60000,   // 60s socket idle timeout
  connectTimeoutMS:         30000,   // 30s to establish connection
  heartbeatFrequencyMS:     10000,   // ping every 10s
  retryWrites:              true,
  retryReads:               true,
  tls:                      URI.includes("mongodb+srv") || URI.includes("ssl=true"),
};

let retryTimer = null;

const connect = async () => {
  // Already connected or connecting
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) return; // connecting

  clearTimeout(retryTimer);

  try {
    await mongoose.connect(URI, OPTIONS);
    logger.info("✅ MongoDB connected");
  } catch (err) {
    logger.error("MongoDB connection failed: " + err.message);
    logger.info("⏳ Retrying in 5 seconds…");
    retryTimer = setTimeout(connect, 5000);
  }
};

// Auto-reconnect on disconnect
mongoose.connection.on("connected", () => {
  logger.info("✅ MongoDB connected");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected — retrying in 5s…");
  retryTimer = setTimeout(connect, 5000);
});

mongoose.connection.on("error", (err) => {
  logger.error("MongoDB error: " + err.message);
  // Don't retry here — "disconnected" event will fire and handle it
});

// Clean shutdown
process.on("SIGINT",  async () => { await mongoose.connection.close(); process.exit(0); });
process.on("SIGTERM", async () => { await mongoose.connection.close(); process.exit(0); });

module.exports = { connect };