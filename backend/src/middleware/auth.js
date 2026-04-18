// src/middleware/auth.js
const Token = require("../models/Token");
const User  = require("../models/User");
const { verifyAccess } = require("../utils/jwt");

/**
 * Authenticate via JWT Bearer or X-API-Key header.
 * Sets req.user, req.token, req.tokenType on success.
 */
const authenticate = async (req, res, next) => {
  try {
    let raw = null;
    let source = "jwt";

    // 1. Bearer Authorization header
    const authHeader = req.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      raw = authHeader.slice(7);
    }

    // 2. X-API-Key header
    if (!raw && req.headers["x-api-key"]) {
      raw = req.headers["x-api-key"];
      source = "api_key";
    }

    if (!raw) return res.status(401).json({ error: "No authentication token provided" });

    let decoded;
    try {
      decoded = verifyAccess(raw);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // For API tokens, verify DB record and update lastUsed
    if (source === "api_key" || decoded.scope) {
      const rec = await Token.findOne({ userId: decoded.sub, isActive: true }).select("+token");
      // find by matching the raw token
      const allRecs = await Token.find({ userId: decoded.sub, isActive: true, tokenType: "api" }).select("+token");
      const matched = allRecs.find(r => r.token === raw);

      if (!matched) return res.status(401).json({ error: "API token not found or revoked" });
      if (matched.expiresAt && new Date() > matched.expiresAt)
        return res.status(401).json({ error: "API token expired" });

      matched.lastUsedAt = new Date();
      matched.lastUsedIp = req.ip;
      await matched.save();

      req.token     = matched;
      req.tokenType = "api";
    } else {
      req.tokenType = "jwt";
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found or deactivated" });

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Require a minimum role level.
 * Usage: requireRole("admin")
 */
const requireRole = (role) => (req, res, next) => {
  const levels = { viewer: 0, member: 1, admin: 2 };
  const userLevel    = levels[req.user?.role] ?? -1;
  const requiredLevel = levels[role] ?? 999;
  if (userLevel < requiredLevel)
    return res.status(403).json({ error: `Requires ${role} role` });
  next();
};

/**
 * Require a token scope (for API tokens).
 * Usage: requireScope("ci_cd")
 */
const requireScope = (scope) => (req, res, next) => {
  if (req.tokenType !== "api") return next(); // session JWTs pass through
  const tokenScope = req.token?.scope;
  if (tokenScope === "full_access" || tokenScope === "admin" || tokenScope === scope)
    return next();
  return res.status(403).json({ error: `Token scope '${tokenScope}' cannot access this resource. Required: ${scope}` });
};

module.exports = { authenticate, requireRole, requireScope };
