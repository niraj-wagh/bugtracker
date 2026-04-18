// src/utils/jwt.js
const jwt = require("jsonwebtoken");

const ACCESS_SECRET  = process.env.JWT_SECRET         || "bugtracker_access_secret_change_me";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "bugtracker_refresh_secret_change_me";
const ACCESS_TTL     = process.env.JWT_ACCESS_TTL     || "15m";
const REFRESH_TTL    = process.env.JWT_REFRESH_TTL    || "7d";

const signAccess = (user) =>
  jwt.sign(
    { sub: user._id, role: user.role, name: user.name, email: user.email },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );

const signRefresh = (user) =>
  jwt.sign(
    { sub: user._id },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );

const signApiToken = (payload, expiresAt) => {
  const opts = {};
  if (expiresAt) opts.expiresIn = Math.floor((new Date(expiresAt) - Date.now()) / 1000);
  return jwt.sign(payload, ACCESS_SECRET, opts);
};

const verifyAccess  = (token) => jwt.verify(token, ACCESS_SECRET);
const verifyRefresh = (token) => jwt.verify(token, REFRESH_SECRET);

const makeTokenPair = (user) => {
  const accessToken  = signAccess(user);
  const refreshToken = signRefresh(user);
  const decoded      = jwt.decode(accessToken);
  return { accessToken, refreshToken, expiresIn: decoded.exp - decoded.iat };
};

module.exports = { signAccess, signRefresh, signApiToken, verifyAccess, verifyRefresh, makeTokenPair };
