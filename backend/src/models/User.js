// src/models/User.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true, maxlength: 80 },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },           // null for Google users
    provider:     { type: String, enum: ["local","google"], default: "local" },
    googleId:     { type: String, default: null, sparse: true },
    googleAvatar: { type: String, default: null },
    role:         { type: String, enum: ["admin", "member", "viewer"], default: "member" },
    avatar:       { type: String, default: "" },
    color:        { type: String, default: "#3b82f6" },
    bio:          { type: String, default: "", maxlength: 300 },
    isActive:     { type: Boolean, default: true },
    lastLoginAt:  { type: Date },
    activeWorkspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
  },
  { timestamps: true }
);

UserSchema.set("toJSON", {
  transform(_, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

UserSchema.methods.verifyPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.statics.hashPassword = async (plain) =>
  bcrypt.hash(plain, 12);

UserSchema.index({ email: 1 });

module.exports = mongoose.model("User", UserSchema);
