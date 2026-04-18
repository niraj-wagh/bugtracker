// src/models/Project.js
const mongoose = require("mongoose");

const MemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role:   { type: String, enum: ["owner", "admin", "member", "viewer"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name:        { type: String, required: true, trim: true, maxlength: 120 },
    slug:        { type: String, lowercase: true },
    description: { type: String, default: "", maxlength: 500 },
    icon:        { type: String, default: "🐞" },
    color:       { type: String, default: "#3b82f6" },
    ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members:     [MemberSchema],
    isArchived:  { type: Boolean, default: false },
    settings: {
      allowMemberInvites: { type: Boolean, default: true },
      defaultStatus:      { type: String, default: "To Do" },
    },
  },
  { timestamps: true }
);

ProjectSchema.index({ workspaceId: 1, ownerId: 1 });
ProjectSchema.index({ "members.userId": 1 });

module.exports = mongoose.model("Project", ProjectSchema);
