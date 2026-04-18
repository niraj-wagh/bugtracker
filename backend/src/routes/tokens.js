// src/routes/tokens.js
const router = require("express").Router();
const { body, param } = require("express-validator");
const crypto = require("crypto");

const Token    = require("../models/Token");
const { signApiToken }  = require("../utils/jwt");
const { authenticate }  = require("../middleware/auth");
const { validate }      = require("../middleware/error");
const { log }           = require("../utils/activity");

const SCOPES = ["full_access", "read_only", "issues_only", "admin", "ci_cd"];

// GET /tokens
router.get("/", authenticate, async (req, res, next) => {
  try {
    const tokens = await Token.find({ userId: req.user._id, tokenType: "api" })
      .select("-token")
      .sort({ createdAt: -1 });
    res.json({ tokens });
  } catch (err) { next(err); }
});

// POST /tokens
router.post(
  "/",
  authenticate,
  [
    body("label").trim().notEmpty().withMessage("Label required").isLength({ max: 80 }),
    body("scope").optional().isIn(SCOPES).withMessage(`Scope must be one of: ${SCOPES.join(", ")}`),
    body("expiresAt").optional({ nullable: true }).isISO8601().withMessage("expiresAt must be ISO date"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { label, scope = "full_access", expiresAt = null } = req.body;

      const payload = {
        sub:   req.user._id,
        role:  req.user.role,
        name:  req.user.name,
        email: req.user.email,
        scope,
        jti:   crypto.randomUUID(),
      };

      const rawToken = signApiToken(payload, expiresAt);

      const rec = await Token.create({
        userId:    req.user._id,
        token:     rawToken,
        label,
        scope,
        tokenType: "api",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      await log({ actorId: req.user._id, action: "token.created", meta: { label, scope } });

      res.status(201).json({
        token: { ...rec.toJSON(), token: rawToken },
        message: "Store this token securely — it will not be shown again.",
      });
    } catch (err) { next(err); }
  }
);

// DELETE /tokens/:id
router.delete(
  "/:id",
  authenticate,
  [param("id").isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const rec = await Token.findOne({ _id: req.params.id, userId: req.user._id });
      if (!rec) return res.status(404).json({ error: "Token not found" });
      if (!rec.isActive) return res.status(400).json({ error: "Token already revoked" });

      rec.isActive  = false;
      rec.revokedAt = new Date();
      rec.revokedBy = req.user._id;
      await rec.save();

      await log({ actorId: req.user._id, action: "token.revoked", meta: { label: rec.label } });

      res.json({ message: "Token revoked" });
    } catch (err) { next(err); }
  }
);

// GET /tokens/verify
router.get("/verify", authenticate, (req, res) => {
  res.json({
    valid: true,
    user:  req.user,
    tokenType: req.tokenType,
    scope: req.token?.scope || "jwt_session",
  });
});

module.exports = router;
