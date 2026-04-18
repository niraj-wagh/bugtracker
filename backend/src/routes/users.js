// src/routes/users.js
const router = require("express").Router();
const { param, body } = require("express-validator");

const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/error");

// GET /users  — admin only
router.get("/", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) { next(err); }
});

// GET /users/:id
router.get("/:id", authenticate, [param("id").isMongoId()], validate, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) { next(err); }
});

// PATCH /users/:id/role  — admin only
router.patch(
  "/:id/role",
  authenticate,
  requireRole("admin"),
  [param("id").isMongoId(), body("role").isIn(["admin","member","viewer"])],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role: req.body.role },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user });
    } catch (err) { next(err); }
  }
);

// PATCH /users/:id/deactivate  — admin only
router.patch("/:id/deactivate", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ error: "Cannot deactivate yourself" });
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) { next(err); }
});

module.exports = router;
