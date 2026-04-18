// src/utils/activity.js
const Activity = require("../models/Activity");

/**
 * Log an activity event.
 * @param {object} opts
 * @param {ObjectId} opts.actorId
 * @param {string}   opts.action
 * @param {ObjectId} [opts.projectId]
 * @param {ObjectId} [opts.ticketId]
 * @param {object}   [opts.meta]
 */
const log = async ({ actorId, action, projectId = null, ticketId = null, meta = {} }) => {
  try {
    await Activity.create({ actorId, action, projectId, ticketId, meta });
  } catch (err) {
    // Non-fatal — log but don't crash
    console.error("[activity] Failed to log:", err.message);
  }
};

module.exports = { log };
