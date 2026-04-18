// src/models/Workspace.js
const mongoose = require("mongoose");

const WS_ROLES = ["owner", "admin", "member", "viewer"];

const WorkspaceMemberSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role:     { type: String, enum: WS_ROLES, default: "member" },
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const WorkspaceSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  slug:        { type: String, lowercase: true, trim: true },   // NOT unique here — index below
  description: { type: String, default: "", maxlength: 500 },
  icon:        { type: String, default: "🏢" },
  color:       { type: String, default: "#3b82f6" },
  ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members:     [WorkspaceMemberSchema],
  plan:        { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
  isArchived:  { type: Boolean, default: false },
}, { timestamps: true });

WorkspaceSchema.index({ ownerId: 1 });
WorkspaceSchema.index({ "members.userId": 1 });
// slug index without unique to avoid duplicate-index warning
WorkspaceSchema.index({ slug: 1 });

module.exports = mongoose.model("Workspace", WorkspaceSchema);
