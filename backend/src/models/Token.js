// src/models/Token.js
const mongoose = require("mongoose");

const SCOPES = ["full_access", "read_only", "issues_only", "admin", "ci_cd"];

const TokenSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    token:      { type: String, required: true, unique: true, select: false },
    label:      { type: String, required: true, trim: true, maxlength: 80 },
    scope:      { type: String, enum: SCOPES, default: "full_access" },
    tokenType:  { type: String, enum: ["api", "session", "refresh"], default: "api" },
    expiresAt:  { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, default: null },
    isActive:   { type: Boolean, default: true },
    revokedAt:  { type: Date, default: null },
    revokedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    metadata:   { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

TokenSchema.virtual("isExpired").get(function () {
  return this.expiresAt ? new Date() > this.expiresAt : false;
});

TokenSchema.virtual("isUsable").get(function () {
  return this.isActive && !this.isExpired;
});

TokenSchema.set("toJSON", { virtuals: true });

// Only these indexes — token field already has unique:true above (no duplicate)
TokenSchema.index({ userId: 1, tokenType: 1, isActive: 1 });
TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Token", TokenSchema);
