// src/models/Invite.js
const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  invitedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email:       { type: String, required: true, lowercase: true, trim: true },
  role:        { type: String, enum: ["admin","member","viewer"], default: "member" },
  token:       { type: String, required: true, unique: true },
  status:      { type: String, enum: ["pending","accepted","declined","expired"], default: "pending" },
  expiresAt:   { type: Date, required: true },
  acceptedAt:  { type: Date, default: null },
}, { timestamps: true });

InviteSchema.index({ token: 1 });
InviteSchema.index({ email: 1, workspaceId: 1 });
InviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Invite", InviteSchema);
