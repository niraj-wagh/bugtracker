// src/models/Epic.js
const mongoose = require("mongoose");

const EpicSchema = new mongoose.Schema({
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: "", maxlength: 2000 },
  color:       { type: String, default: "#8b5cf6" },
  status:      { type: String, enum: ["planned","in_progress","done","cancelled"], default: "planned" },
  priority:    { type: String, enum: ["Critical","High","Medium","Low"], default: "Medium" },
  startDate:   { type: Date, default: null },
  dueDate:     { type: Date, default: null },
  ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  progress:    { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

EpicSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model("Epic", EpicSchema);
