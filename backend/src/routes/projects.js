// src/routes/projects.js
const router = require("express").Router();
const { body, param } = require("express-validator");

const Project   = require("../models/Project");
const Workspace = require("../models/Workspace");
const Ticket    = require("../models/Ticket");
const Epic      = require("../models/Epic");
const User      = require("../models/User");
const Activity  = require("../models/Activity");
const { authenticate } = require("../middleware/auth");
const { validate }     = require("../middleware/error");
const { log }          = require("../utils/activity");

const isMember = (project, userId) =>
  project.ownerId.toString() === userId.toString() ||
  project.members.some(m => m.userId.toString() === userId.toString());

const isWsMember = (ws, userId) =>
  ws.ownerId.toString() === userId.toString() ||
  ws.members.some(m => m.userId.toString() === userId.toString());

// GET /projects?workspaceId=xxx
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const query = {
      $or: [{ ownerId: req.user._id }, { "members.userId": req.user._id }],
    };
    if (workspaceId) query.workspaceId = workspaceId;

    const projects = await Project.find(query)
      .populate("ownerId", "name email color avatar")
      .populate("members.userId", "name email color avatar")
      .sort({ createdAt: -1 });

    const counts = await Ticket.aggregate([
      { $match: { projectId: { $in: projects.map(p => p._id) }, isArchived: false } },
      { $group: { _id: "$projectId", count: { $sum: 1 }, open: { $sum: { $cond: [{ $ne: ["$status","Done"] }, 1, 0] } } } },
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c]));

    const result = projects.map(p => ({
      ...p.toJSON(),
      _ticketCount: countMap[p._id.toString()]?.count ?? 0,
      _openCount:   countMap[p._id.toString()]?.open  ?? 0,
    }));

    res.json({ projects: result });
  } catch (err) { next(err); }
});

// POST /projects
router.post("/", authenticate,
  [
    body("name").trim().notEmpty().isLength({ max: 120 }),
    body("workspaceId").notEmpty().withMessage("workspaceId required").isMongoId(),
    body("description").optional().isLength({ max: 500 }),
    body("color").optional().matches(/^#[0-9a-fA-F]{6}$/),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, color, icon, workspaceId } = req.body;

      const ws = await Workspace.findById(workspaceId);
      if (!ws) return res.status(404).json({ error: "Workspace not found" });
      if (!isWsMember(ws, req.user._id)) return res.status(403).json({ error: "Not a workspace member" });

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
        + "-" + Date.now().toString(36);

      const project = await Project.create({
        name, description, color, icon, slug,
        workspaceId,
        ownerId: req.user._id,
        members: [{ userId: req.user._id, role: "owner" }],
      });

      await log({ projectId: project._id, actorId: req.user._id, action: "project.created", meta: { name } });
      await project.populate("ownerId", "name email color avatar");
      res.status(201).json({ project });
    } catch (err) { next(err); }
  }
);

// GET /projects/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("ownerId", "name email color avatar")
      .populate("members.userId", "name email color avatar");
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Not a project member" });
    res.json({ project });
  } catch (err) { next(err); }
});

// PATCH /projects/:id
router.patch("/:id", authenticate,
  [body("name").optional().trim().isLength({ min:1, max:120 })],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (project.ownerId.toString() !== req.user._id.toString() && req.user.role !== "admin")
        return res.status(403).json({ error: "Only owner can update project" });

      const allowed = ["name","description","color","icon","isArchived","settings"];
      allowed.forEach(k => { if (req.body[k] !== undefined) project[k] = req.body[k]; });
      await project.save();
      res.json({ project });
    } catch (err) { next(err); }
  }
);

// DELETE /projects/:id
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.ownerId.toString() !== req.user._id.toString() && req.user.role !== "admin")
      return res.status(403).json({ error: "Only owner can delete project" });

    await Ticket.deleteMany({ projectId: project._id });
    await Epic.deleteMany({ projectId: project._id });
    await project.deleteOne();
    res.json({ message: "Project deleted" });
  } catch (err) { next(err); }
});

// POST /projects/:id/members
router.post("/:id/members", authenticate,
  [body("email").isEmail().normalizeEmail(), body("role").optional().isIn(["admin","member","viewer"])],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

      const user = await User.findOne({ email: req.body.email });
      if (!user) return res.status(404).json({ error: "User not found" });

      const already = project.members.some(m => m.userId.toString() === user._id.toString());
      if (already) return res.status(409).json({ error: "Already a member" });

      project.members.push({ userId: user._id, role: req.body.role || "member" });
      await project.save();
      await project.populate("members.userId", "name email color avatar");
      res.status(201).json({ members: project.members });
    } catch (err) { next(err); }
  }
);

// DELETE /projects/:id/members/:userId
router.delete("/:id/members/:userId", authenticate, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    project.members = project.members.filter(m => m.userId.toString() !== req.params.userId);
    await project.save();
    res.json({ message: "Member removed" });
  } catch (err) { next(err); }
});

// GET /projects/:id/activity
router.get("/:id/activity", authenticate, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });
    const activities = await Activity.find({ projectId: project._id })
      .populate("actorId", "name email color avatar")
      .sort({ createdAt: -1 }).limit(50);
    res.json({ activities });
  } catch (err) { next(err); }
});

// GET /projects/:id/stats
router.get("/:id/stats", authenticate, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    const [byStatus, byPriority] = await Promise.all([
      Ticket.aggregate([
        { $match: { projectId: project._id, isArchived: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: { projectId: project._id, isArchived: false } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
    ]);

    const totalTickets = await Ticket.countDocuments({ projectId: project._id, isArchived: false });
    const openTickets  = await Ticket.countDocuments({ projectId: project._id, isArchived: false, status: { $ne: "Done" } });

    res.json({
      stats: {
        totalTickets, openTickets,
        doneTickets: totalTickets - openTickets,
        byStatus:   Object.fromEntries(byStatus.map(s => [s._id, s.count])),
        byPriority: Object.fromEntries(byPriority.map(p => [p._id, p.count])),
        members: project.members.length,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
