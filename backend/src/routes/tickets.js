// src/routes/tickets.js
const router = require("express").Router();
const { body, param, query } = require("express-validator");

const Ticket   = require("../models/Ticket");
const Project  = require("../models/Project");
const Comment  = require("../models/Comment");
const { authenticate } = require("../middleware/auth");
const { validate }     = require("../middleware/error");
const { log }          = require("../utils/activity");

const STATUSES   = ["Backlog","To Do","In Progress","Review","Done"];
const PRIORITIES = ["Critical","High","Medium","Low"];

const isMember = (project, userId) =>
  project.ownerId.toString() === userId.toString() ||
  project.members.some((m) => m.userId.toString() === userId.toString());

// GET /projects/:projectId/tickets
router.get("/projects/:projectId/tickets", authenticate,
  [
    query("status").optional().isIn(STATUSES),
    query("priority").optional().isIn(PRIORITIES),
    query("assigneeId").optional().isMongoId(),
    query("q").optional().isString(),
    query("page").optional().isInt({ min:1 }),
    query("limit").optional().isInt({ min:1, max:100 }),
    query("sort").optional().isIn(["createdAt","-createdAt","priority","updatedAt","-updatedAt"]),
  ],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

      const { status, priority, assigneeId, q, page=1, limit=50, sort="-createdAt" } = req.query;

      const filter = { projectId: project._id, isArchived: false };
      if (status)     filter.status     = status;
      if (priority)   filter.priority   = priority;
      if (assigneeId) filter.assigneeId = assigneeId;
      if (q)          filter.$text      = { $search: q };

      const sortObj = sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

      const [tickets, total] = await Promise.all([
        Ticket.find(filter)
          .sort(sortObj)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .populate("reporterId", "name email color avatar")
          .populate("assigneeId", "name email color avatar"),
        Ticket.countDocuments(filter),
      ]);

      res.json({ tickets, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
  }
);

// POST /projects/:projectId/tickets
router.post(
  "/projects/:projectId/tickets",
  authenticate,
  [
    body("title").trim().notEmpty().isLength({ max: 250 }),
    body("description").optional().isLength({ max: 10000 }),
    body("priority").optional().isIn(PRIORITIES),
    body("status").optional().isIn(STATUSES),
    body("assigneeId").optional({ nullable:true }).isMongoId(),
    body("estimate").optional().isFloat({ min:0 }),
    body("dueDate").optional({ nullable:true }).isISO8601(),
    body("labels").optional().isArray(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

      const ticket = await Ticket.create({
        ...req.body,
        projectId:  project._id,
        reporterId: req.user._id,
      });

      await ticket.populate([
        { path: "reporterId", select: "name email color avatar" },
        { path: "assigneeId", select: "name email color avatar" },
      ]);

      await log({ projectId: project._id, ticketId: ticket._id, actorId: req.user._id,
        action: "ticket.created", meta: { title: ticket.title, priority: ticket.priority } });

      res.status(201).json({ ticket });
    } catch (err) { next(err); }
  }
);

// GET /tickets/:id
router.get("/tickets/:id", authenticate, [param("id").isMongoId()], validate, async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("reporterId", "name email color avatar")
      .populate("assigneeId", "name email color avatar");

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const project = await Project.findById(ticket.projectId);
    if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    const comments = await Comment.find({ ticketId: ticket._id })
      .populate("authorId", "name email color avatar")
      .sort({ createdAt: 1 });

    res.json({ ticket, comments });
  } catch (err) { next(err); }
});

// PATCH /tickets/:id
router.patch("/tickets/:id", authenticate, [param("id").isMongoId()], validate, async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const project = await Project.findById(ticket.projectId);
    if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    const prevStatus = ticket.status;
    const allowed = ["title","description","status","priority","assigneeId","labels","estimate","timeSpent","dueDate"];
    allowed.forEach((k) => { if (req.body[k] !== undefined) ticket[k] = req.body[k]; });

    if (req.body.status && req.body.status !== prevStatus) {
      ticket.statusHistory.push({ from: prevStatus, to: req.body.status, changedBy: req.user._id });
      await log({ projectId: project._id, ticketId: ticket._id, actorId: req.user._id,
        action: "ticket.status_changed", meta: { from: prevStatus, to: req.body.status } });
    }

    await ticket.save();
    await ticket.populate([
      { path: "reporterId", select: "name email color avatar" },
      { path: "assigneeId", select: "name email color avatar" },
    ]);

    await log({ projectId: project._id, ticketId: ticket._id, actorId: req.user._id,
      action: "ticket.updated", meta: { fields: Object.keys(req.body) } });

    res.json({ ticket });
  } catch (err) { next(err); }
});

// DELETE /tickets/:id
router.delete("/tickets/:id", authenticate, [param("id").isMongoId()], validate, async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const project = await Project.findById(ticket.projectId);
    if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

    await Comment.deleteMany({ ticketId: ticket._id });
    await ticket.deleteOne();

    await log({ projectId: project._id, actorId: req.user._id,
      action: "ticket.deleted", meta: { title: ticket.title } });

    res.json({ message: "Ticket deleted" });
  } catch (err) { next(err); }
});

// POST /tickets/:id/comments
router.post("/tickets/:id/comments", authenticate,
  [param("id").isMongoId(), body("body").trim().notEmpty().isLength({ max: 5000 })],
  validate,
  async (req, res, next) => {
    try {
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const project = await Project.findById(ticket.projectId);
      if (!isMember(project, req.user._id)) return res.status(403).json({ error: "Forbidden" });

      const comment = await Comment.create({
        ticketId: ticket._id,
        authorId: req.user._id,
        body:     req.body.body,
        parentId: req.body.parentId || null,
      });

      await comment.populate("authorId", "name email color avatar");

      await log({ projectId: project._id, ticketId: ticket._id, actorId: req.user._id,
        action: "comment.created", meta: { commentId: comment._id.toString() } });

      res.status(201).json({ comment });
    } catch (err) { next(err); }
  }
);

// PATCH /tickets/:id/comments/:commentId
router.patch("/tickets/:id/comments/:commentId", authenticate,
  [param("commentId").isMongoId(), body("body").trim().notEmpty().isLength({ max: 5000 })],
  validate,
  async (req, res, next) => {
    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      if (comment.authorId.toString() !== req.user._id.toString())
        return res.status(403).json({ error: "You can only edit your own comments" });

      comment.body     = req.body.body;
      comment.isEdited = true;
      comment.editedAt = new Date();
      await comment.save();
      await comment.populate("authorId", "name email color avatar");

      res.json({ comment });
    } catch (err) { next(err); }
  }
);

// DELETE /tickets/:id/comments/:commentId
router.delete("/tickets/:id/comments/:commentId", authenticate,
  [param("commentId").isMongoId()], validate,
  async (req, res, next) => {
    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      if (comment.authorId.toString() !== req.user._id.toString() && req.user.role !== "admin")
        return res.status(403).json({ error: "Forbidden" });

      await comment.deleteOne();
      res.json({ message: "Comment deleted" });
    } catch (err) { next(err); }
  }
);

module.exports = router;
