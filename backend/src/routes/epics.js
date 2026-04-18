// src/routes/epics.js
const router = require("express").Router();
const { body, param } = require("express-validator");

const Epic    = require("../models/Epic");
const Project = require("../models/Project");
const Ticket  = require("../models/Ticket");
const Workspace = require("../models/Workspace");
const { authenticate } = require("../middleware/auth");
const { validate }     = require("../middleware/error");

const isMember = (p, uid) =>
  p.ownerId.toString() === uid.toString() ||
  p.members.some(m => m.userId.toString() === uid.toString());

// GET /projects/:projectId/epics
router.get("/projects/:projectId/epics", authenticate, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    const epics = await Epic.find({ projectId: project._id })
      .populate("ownerId", "name email color avatar")
      .sort({ createdAt: -1 });

    // Calculate progress for each epic
    const epicIds = epics.map(e => e._id);
    const ticketCounts = await Ticket.aggregate([
      { $match: { epicId: { $in: epicIds }, isArchived: false } },
      { $group: {
        _id: "$epicId",
        total: { $sum: 1 },
        done:  { $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] } },
      }},
    ]);
    const tcMap = Object.fromEntries(ticketCounts.map(t => [t._id.toString(), t]));

    const result = epics.map(e => {
      const tc = tcMap[e._id.toString()];
      const progress = tc && tc.total > 0 ? Math.round((tc.done / tc.total) * 100) : 0;
      return { ...e.toJSON(), progress, _totalTickets: tc?.total || 0, _doneTickets: tc?.done || 0 };
    });

    res.json({ epics: result });
  } catch (err) { next(err); }
});

// POST /projects/:projectId/epics
router.post("/projects/:projectId/epics", authenticate,
  [
    body("title").trim().notEmpty().isLength({ max: 200 }),
    body("description").optional().isLength({ max: 2000 }),
    body("priority").optional().isIn(["Critical","High","Medium","Low"]),
    body("status").optional().isIn(["planned","in_progress","done","cancelled"]),
    body("color").optional().matches(/^#[0-9a-fA-F]{6}$/),
    body("dueDate").optional({ nullable: true }).isISO8601(),
    body("startDate").optional({ nullable: true }).isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

      const epic = await Epic.create({
        ...req.body,
        projectId: project._id,
        workspaceId: project.workspaceId,
        ownerId: req.body.ownerId || req.user._id,
      });
      await epic.populate("ownerId", "name email color avatar");
      res.status(201).json({ epic });
    } catch (err) { next(err); }
  }
);

// PATCH /epics/:id
router.patch("/epics/:id", authenticate, [param("id").isMongoId()], validate, async (req, res, next) => {
  try {
    const epic = await Epic.findById(req.params.id);
    if (!epic) return res.status(404).json({ error: "Epic not found" });

    const project = await Project.findById(epic.projectId);
    if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    const allowed = ["title","description","status","priority","color","dueDate","startDate","ownerId"];
    allowed.forEach(k => { if (req.body[k] !== undefined) epic[k] = req.body[k]; });
    await epic.save();
    await epic.populate("ownerId", "name email color avatar");
    res.json({ epic });
  } catch (err) { next(err); }
});

// DELETE /epics/:id
router.delete("/epics/:id", authenticate, [param("id").isMongoId()], validate, async (req, res, next) => {
  try {
    const epic = await Epic.findById(req.params.id);
    if (!epic) return res.status(404).json({ error: "Epic not found" });
    const project = await Project.findById(epic.projectId);
    if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    // Unlink tickets from epic
    await Ticket.updateMany({ epicId: epic._id }, { epicId: null });
    await epic.deleteOne();
    res.json({ message: "Epic deleted" });
  } catch (err) { next(err); }
});

module.exports = router;
