// src/models/Activity.js
const mongoose = require("mongoose");

const ACTIONS = [
  "user.registered","user.login",
  "project.created","project.updated","project.member_added","project.member_removed",
  "ticket.created","ticket.updated","ticket.status_changed","ticket.deleted",
  "comment.created","comment.deleted",
  "token.created","token.revoked",
];

const ActivitySchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    ticketId:  { type: mongoose.Schema.Types.ObjectId, ref: "Ticket",  default: null },
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    action:    { type: String, enum: ACTIONS, required: true },
    meta:      { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivitySchema.index({ projectId: 1, createdAt: -1 });
ActivitySchema.index({ actorId: 1 });

module.exports = mongoose.model("Activity", ActivitySchema);
