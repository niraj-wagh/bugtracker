// src/routes/workspaces.js
const router = require("express").Router();
const { body, param } = require("express-validator");
const crypto = require("crypto");

const Workspace = require("../models/Workspace");
const Project   = require("../models/Project");
const Ticket    = require("../models/Ticket");
const Invite    = require("../models/Invite");
const User      = require("../models/User");
const Activity  = require("../models/Activity");
const { authenticate } = require("../middleware/auth");
const { validate }     = require("../middleware/error");
const { log }          = require("../utils/activity");

const isMember = (ws, userId) =>
  ws.ownerId.toString() === userId.toString() ||
  ws.members.some(m => m.userId.toString() === userId.toString());

const getMemberRole = (ws, userId) => {
  if (ws.ownerId.toString() === userId.toString()) return "owner";
  const m = ws.members.find(m => m.userId.toString() === userId.toString());
  return m ? m.role : null;
};

const canManage = (role) => ["owner","admin"].includes(role);

// GET /workspaces — list all workspaces for current user
router.get("/", authenticate, async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({
      $or: [{ ownerId: req.user._id }, { "members.userId": req.user._id }],
      isArchived: false,
    })
      .populate("ownerId", "name email color avatar")
      .sort({ createdAt: -1 });

    // Add project counts
    const counts = await Project.aggregate([
      { $match: { workspaceId: { $in: workspaces.map(w => w._id) } } },
      { $group: { _id: "$workspaceId", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));

    const result = workspaces.map(w => ({
      ...w.toJSON(),
      _projectCount: countMap[w._id.toString()] || 0,
      _myRole: getMemberRole(w, req.user._id),
    }));

    res.json({ workspaces: result });
  } catch (err) { next(err); }
});

// POST /workspaces — create workspace
router.post("/",
  authenticate,
  [
    body("name").trim().notEmpty().isLength({ max: 100 }),
    body("description").optional().isLength({ max: 500 }),
    body("color").optional().matches(/^#[0-9a-fA-F]{6}$/),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, color, icon } = req.body;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
        + "-" + Date.now().toString(36);

      const workspace = await Workspace.create({
        name, description, color: color || "#3b82f6", icon: icon || "🏢",
        slug,
        ownerId: req.user._id,
        members: [{ userId: req.user._id, role: "owner" }],
      });

      // Update user's active workspace
      await User.findByIdAndUpdate(req.user._id, { activeWorkspaceId: workspace._id });

      await log({ actorId: req.user._id, action: "project.created", meta: { name, type: "workspace" } });
      await workspace.populate("ownerId", "name email color avatar");
      res.status(201).json({ workspace });
    } catch (err) { next(err); }
  }
);

// GET /workspaces/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id)
      .populate("ownerId", "name email color avatar")
      .populate("members.userId", "name email color avatar");
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    if (!isMember(ws, req.user._id)) return res.status(403).json({ error: "Not a member" });
    res.json({ workspace: { ...ws.toJSON(), _myRole: getMemberRole(ws, req.user._id) } });
  } catch (err) { next(err); }
});

// PATCH /workspaces/:id
router.patch("/:id", authenticate,
  [body("name").optional().trim().isLength({ min:1, max:100 })],
  validate,
  async (req, res, next) => {
    try {
      const ws = await Workspace.findById(req.params.id);
      if (!ws) return res.status(404).json({ error: "Workspace not found" });
      const role = getMemberRole(ws, req.user._id);
      if (!canManage(role)) return res.status(403).json({ error: "Insufficient permissions" });

      const allowed = ["name","description","color","icon","isArchived"];
      allowed.forEach(k => { if (req.body[k] !== undefined) ws[k] = req.body[k]; });
      await ws.save();
      res.json({ workspace: ws });
    } catch (err) { next(err); }
  }
);

// DELETE /workspaces/:id
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    if (ws.ownerId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Only owner can delete workspace" });

    await Project.deleteMany({ workspaceId: ws._id });
    await ws.deleteOne();
    res.json({ message: "Workspace deleted" });
  } catch (err) { next(err); }
});

// GET /workspaces/:id/stats — analytics
router.get("/:id/stats", authenticate, async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws || !isMember(ws, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    const projects = await Project.find({ workspaceId: ws._id });
    const projectIds = projects.map(p => p._id);

    const [byStatus, byPriority, byAssignee, recentActivity, overdue] = await Promise.all([
      Ticket.aggregate([
        { $match: { projectId: { $in: projectIds }, isArchived: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: { projectId: { $in: projectIds }, isArchived: false } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: { projectId: { $in: projectIds }, isArchived: false, assigneeId: { $ne: null } } },
        { $group: { _id: "$assigneeId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $project: { count: 1, "user.name": 1, "user.color": 1, "user.avatar": 1 } },
      ]),
      Ticket.find({ projectId: { $in: projectIds }, isArchived: false })
        .sort({ updatedAt: -1 }).limit(10)
        .populate("reporterId", "name color avatar")
        .populate("assigneeId", "name color avatar"),
      Ticket.countDocuments({
        projectId: { $in: projectIds },
        isArchived: false,
        status: { $ne: "Done" },
        dueDate: { $lt: new Date() },
      }),
    ]);

    const totalTickets = await Ticket.countDocuments({ projectId: { $in: projectIds }, isArchived: false });
    const doneTickets  = await Ticket.countDocuments({ projectId: { $in: projectIds }, status: "Done" });

    // Velocity: tickets done in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const velocity = await Ticket.countDocuments({
      projectId: { $in: projectIds },
      status: "Done",
      updatedAt: { $gte: weekAgo },
    });

    res.json({
      stats: {
        totalProjects: projects.length,
        totalMembers: ws.members.length,
        totalTickets,
        doneTickets,
        openTickets: totalTickets - doneTickets,
        overdueTickets: overdue,
        velocity,
        completionRate: totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0,
        byStatus:    Object.fromEntries(byStatus.map(s => [s._id, s.count])),
        byPriority:  Object.fromEntries(byPriority.map(p => [p._id, p.count])),
        byAssignee,
        recentActivity,
      },
    });
  } catch (err) { next(err); }
});

// GET /workspaces/:id/members
router.get("/:id/members", authenticate, async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id)
      .populate("members.userId", "name email color avatar role lastLoginAt");
    if (!ws || !isMember(ws, req.user._id)) return res.status(403).json({ error: "Forbidden" });
    res.json({ members: ws.members });
  } catch (err) { next(err); }
});

// PATCH /workspaces/:id/members/:userId/role
router.patch("/:id/members/:userId/role", authenticate,
  [body("role").isIn(["admin","member","viewer"])],
  validate,
  async (req, res, next) => {
    try {
      const ws = await Workspace.findById(req.params.id);
      if (!ws) return res.status(404).json({ error: "Workspace not found" });
      const myRole = getMemberRole(ws, req.user._id);
      if (!canManage(myRole)) return res.status(403).json({ error: "Insufficient permissions" });

      const member = ws.members.find(m => m.userId.toString() === req.params.userId);
      if (!member) return res.status(404).json({ error: "Member not found" });
      if (member.role === "owner") return res.status(400).json({ error: "Cannot change owner role" });

      member.role = req.body.role;
      await ws.save();
      res.json({ message: "Role updated", members: ws.members });
    } catch (err) { next(err); }
  }
);

// DELETE /workspaces/:id/members/:userId
router.delete("/:id/members/:userId", authenticate, async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    const myRole = getMemberRole(ws, req.user._id);
    const isSelf = req.params.userId === req.user._id.toString();
    if (!canManage(myRole) && !isSelf) return res.status(403).json({ error: "Insufficient permissions" });

    ws.members = ws.members.filter(m => m.userId.toString() !== req.params.userId);
    await ws.save();
    res.json({ message: "Member removed" });
  } catch (err) { next(err); }
});

// POST /workspaces/:id/invite — send invite by email
router.post("/:id/invite", authenticate,
  [body("email").isEmail().normalizeEmail(), body("role").optional().isIn(["admin","member","viewer"])],
  validate,
  async (req, res, next) => {
    try {
      const ws = await Workspace.findById(req.params.id);
      if (!ws) return res.status(404).json({ error: "Workspace not found" });
      const myRole = getMemberRole(ws, req.user._id);
      if (!canManage(myRole)) return res.status(403).json({ error: "Insufficient permissions" });

      const { email, role = "member" } = req.body;

      // Check if already a member
      const existingUser = await User.findOne({ email });
      if (existingUser && isMember(ws, existingUser._id))
        return res.status(409).json({ error: "User is already a member" });

      // Cancel existing pending invite
      await Invite.deleteMany({ workspaceId: ws._id, email, status: "pending" });

      const token = crypto.randomBytes(32).toString("hex");
      const invite = await Invite.create({
        workspaceId: ws._id,
        invitedBy: req.user._id,
        email,
        role,
        token,
        expiresAt: new Date(Date.now() + 7 * 86400000), // 7 days
      });

      // If user already exists, add directly
      if (existingUser) {
        ws.members.push({ userId: existingUser._id, role });
        await ws.save();
        invite.status = "accepted";
        invite.acceptedAt = new Date();
        await invite.save();
        return res.json({ message: "User added directly (already has account)", invite });
      }

      // Return invite link (in production, send email)
      const inviteLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/invite/${token}`;
      res.status(201).json({ message: "Invite created", invite, inviteLink });
    } catch (err) { next(err); }
  }
);

// GET /workspaces/:id/invites — list pending invites
router.get("/:id/invites", authenticate, async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws || !isMember(ws, req.user._id)) return res.status(403).json({ error: "Forbidden" });
    const invites = await Invite.find({ workspaceId: ws._id, status: "pending" })
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ invites });
  } catch (err) { next(err); }
});

// POST /workspaces/accept-invite/:token — accept an invite
router.post("/accept-invite/:token", authenticate, async (req, res, next) => {
  try {
    const invite = await Invite.findOne({ token: req.params.token, status: "pending" })
      .populate("workspaceId");
    if (!invite) return res.status(404).json({ error: "Invite not found or expired" });
    if (new Date() > invite.expiresAt) {
      invite.status = "expired"; await invite.save();
      return res.status(410).json({ error: "Invite has expired" });
    }

    const ws = invite.workspaceId;
    if (!isMember(ws, req.user._id)) {
      ws.members.push({ userId: req.user._id, role: invite.role });
      await ws.save();
    }

    invite.status = "accepted";
    invite.acceptedAt = new Date();
    await invite.save();

    res.json({ message: "Joined workspace!", workspace: ws });
  } catch (err) { next(err); }
});

// DELETE /workspaces/:id/invites/:inviteId — cancel invite
router.delete("/:id/invites/:inviteId", authenticate, async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    const myRole = getMemberRole(ws, req.user._id);
    if (!canManage(myRole)) return res.status(403).json({ error: "Insufficient permissions" });

    await Invite.findByIdAndDelete(req.params.inviteId);
    res.json({ message: "Invite cancelled" });
  } catch (err) { next(err); }
});

module.exports = router;
