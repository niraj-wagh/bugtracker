// src/models/Ticket.js
const mongoose = require("mongoose");

const STATUSES   = ["Backlog", "To Do", "In Progress", "Review", "Done"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];

const AttachmentSchema = new mongoose.Schema(
  {
    filename: String,
    url:      String,
    size:     Number,
    mimeType: String,
  },
  { _id: false, timestamps: true }
);

const TicketSchema = new mongoose.Schema(
  {
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: "Project",   required: true, index: true },
    workspaceId:{ type: mongoose.Schema.Types.ObjectId, ref: "Workspace",  index: true },
    epicId:     { type: mongoose.Schema.Types.ObjectId, ref: "Epic",       default: null },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User",      required: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User",      default: null  },
    title:       { type: String, required: true, trim: true, maxlength: 250 },
    description: { type: String, default: "", maxlength: 10000 },
    status:      { type: String, enum: STATUSES,   default: "To Do"  },
    priority:    { type: String, enum: PRIORITIES, default: "Medium" },
    labels:      [{ type: String, trim: true, maxlength: 40 }],
    estimate:    { type: Number, default: 0, min: 0 },
    timeSpent:   { type: Number, default: 0, min: 0 },
    dueDate:     { type: Date, default: null },
    attachments: [AttachmentSchema],
    ticketNumber: { type: Number },
    statusHistory: [
      {
        from:      String,
        to:        String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TicketSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Ticket = this.constructor;
    const last = await Ticket.findOne({ projectId: this.projectId })
      .sort({ ticketNumber: -1 })
      .select("ticketNumber");
    this.ticketNumber = (last?.ticketNumber ?? 0) + 1;
  }
  next();
});

TicketSchema.index({ projectId: 1, status: 1 });
TicketSchema.index({ projectId: 1, priority: 1 });
TicketSchema.index({ projectId: 1, assigneeId: 1 });
TicketSchema.index({ projectId: 1, ticketNumber: 1 }, { unique: true });
TicketSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Ticket", TicketSchema);
