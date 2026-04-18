// src/routes/auth.js
const router   = require("express").Router();
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const jwt_lib   = require("jsonwebtoken");

const User      = require("../models/User");
const Token     = require("../models/Token");
const Workspace = require("../models/Workspace");
const { makeTokenPair, verifyRefresh } = require("../utils/jwt");
const { authenticate } = require("../middleware/auth");
const { validate }     = require("../middleware/error");
const { log }          = require("../utils/activity");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  message: { error: "Too many auth attempts. Try again in 15 minutes." },
  standardHeaders: true, legacyHeaders: false,
});

/* ─────────────────────────────────────────────────────────────
   POST /auth/register
───────────────────────────────────────────────────────────── */
router.post("/register", authLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 80 }),
    body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be ≥ 6 characters"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, color } = req.body;

      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: "Email already registered" });

      const passwordHash = await User.hashPassword(password);
      const COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#ec4899"];
      const count  = await User.countDocuments();

      const user = await User.create({
        name, email, passwordHash,
        color: color || COLORS[count % COLORS.length],
        avatar: name[0].toUpperCase(),
        role: count === 0 ? "admin" : "member",
        provider: "local",
      });

      const { accessToken, refreshToken, expiresIn } = makeTokenPair(user);
      await Token.create({
        userId: user._id, token: refreshToken, label: "Session",
        tokenType: "refresh", scope: "full_access",
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });

      await log({ actorId: user._id, action: "user.registered", meta: { email } });
      res.status(201).json({ user, accessToken, refreshToken, expiresIn });
    } catch (err) { next(err); }
  }
);

/* ─────────────────────────────────────────────────────────────
   POST /auth/login
───────────────────────────────────────────────────────────── */
router.post("/login", authLimiter,
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty().withMessage("Password required"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email }).select("+passwordHash");
      if (!user || !user.isActive)
        return res.status(401).json({ error: "Invalid credentials" });

      // Google-only accounts have no password
      if (user.provider === "google" && !user.passwordHash)
        return res.status(401).json({ error: "This account uses Google Sign-In" });

      const valid = await user.verifyPassword(password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      user.lastLoginAt = new Date();
      await user.save();

      const { accessToken, refreshToken, expiresIn } = makeTokenPair(user);
      await Token.create({
        userId: user._id, token: refreshToken, label: "Session",
        tokenType: "refresh", scope: "full_access",
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });

      await log({ actorId: user._id, action: "user.login", meta: { email, ip: req.ip } });
      res.json({ user: user.toJSON(), accessToken, refreshToken, expiresIn });
    } catch (err) { next(err); }
  }
);

/* ─────────────────────────────────────────────────────────────
   POST /auth/google — Google Sign-In (OAuth2 token)
───────────────────────────────────────────────────────────── */
router.post("/google", authLimiter, async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Google credential required" });

    let payload;
    try {
      payload = jwt_lib.decode(credential);
      if (!payload || !payload.email) throw new Error("Invalid token");
    } catch {
      return res.status(401).json({ error: "Invalid Google credential" });
    }

    const { email, name, picture, sub: googleId } = payload;
    const COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#ec4899"];

    let user = await User.findOne({ email });
    if (!user) {
      const count = await User.countDocuments();
      user = await User.create({
        name: name || email.split("@")[0],
        email, provider: "google",
        googleId, googleAvatar: picture,
        avatar: (name || email)[0].toUpperCase(),
        color: COLORS[count % COLORS.length],
        role: count === 0 ? "admin" : "member",
      });
    } else {
      user.googleId = googleId;
      user.googleAvatar = picture;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const { accessToken, refreshToken, expiresIn } = makeTokenPair(user);
    await Token.create({
      userId: user._id, token: refreshToken, label: "Google Session",
      tokenType: "refresh", scope: "full_access",
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    res.json({ user, accessToken, refreshToken, expiresIn });
  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────────────────
   POST /auth/refresh — rotate refresh token
───────────────────────────────────────────────────────────── */
router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

    let decoded;
    try { decoded = verifyRefresh(refreshToken); }
    catch { return res.status(401).json({ error: "Invalid or expired refresh token" }); }

    const rec = await Token.findOne({ token: refreshToken, isActive: true, tokenType: "refresh" }).select("+token");
    if (!rec) return res.status(401).json({ error: "Refresh token revoked" });

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found" });

    // Rotate
    rec.isActive = false; rec.revokedAt = new Date();
    await rec.save();

    const { accessToken, refreshToken: newRefresh, expiresIn } = makeTokenPair(user);
    await Token.create({
      userId: user._id, token: newRefresh, label: "Session",
      tokenType: "refresh", scope: "full_access",
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    res.json({ accessToken, refreshToken: newRefresh, expiresIn });
  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────────────────
   POST /auth/logout
───────────────────────────────────────────────────────────── */
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await Token.updateMany(
        { userId: req.user._id, tokenType: "refresh", isActive: true },
        { isActive: false, revokedAt: new Date() }
      );
    }
    res.json({ message: "Logged out" });
  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────────────────
   GET /auth/me
───────────────────────────────────────────────────────────── */
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────────────────
   GET /auth/bootstrap — one-shot: user + workspaces on login
   This is the KEY endpoint that restores state after login/refresh
───────────────────────────────────────────────────────────── */
router.get("/bootstrap", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get all workspaces this user belongs to
    const workspaces = await Workspace.find({
      $or: [{ ownerId: user._id }, { "members.userId": user._id }],
      isArchived: false,
    })
      .populate("ownerId", "name email color avatar")
      .populate("members.userId", "name email color avatar")
      .sort({ createdAt: 1 });

    // Determine active workspace
    let activeWorkspaceId = null;
    if (user.activeWorkspaceId) {
      // Verify it still exists and user is still a member
      const still = workspaces.find(w => w._id.toString() === user.activeWorkspaceId.toString());
      activeWorkspaceId = still ? user.activeWorkspaceId : null;
    }
    if (!activeWorkspaceId && workspaces.length) {
      activeWorkspaceId = workspaces[0]._id;
      // Persist preference
      await User.findByIdAndUpdate(user._id, { activeWorkspaceId });
    }

    res.json({ user, workspaces, activeWorkspaceId });
  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────────────────
   PATCH /auth/me — update profile + activeWorkspaceId
───────────────────────────────────────────────────────────── */
router.patch("/me", authenticate,
  [
    body("name").optional().trim().isLength({ min:1, max:80 }),
    body("bio").optional().isLength({ max:300 }),
    body("color").optional().matches(/^#[0-9a-fA-F]{6}$/),
    body("password").optional().isLength({ min:6 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, bio, color, password, activeWorkspaceId } = req.body;
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (name)  { user.name = name; user.avatar = name[0].toUpperCase(); }
      if (bio !== undefined) user.bio = bio;
      if (color) user.color = color;
      if (password) user.passwordHash = await User.hashPassword(password);
      if (activeWorkspaceId) user.activeWorkspaceId = activeWorkspaceId;

      await user.save();
      res.json({ user });
    } catch (err) { next(err); }
  }
);

module.exports = router;
