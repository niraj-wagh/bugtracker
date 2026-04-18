// src/models/Comment.js
const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User",   required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    body:     { type: String, required: true, trim: true, maxlength: 5000 },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date,    default: null  },
  },
  { timestamps: true }
);

CommentSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", CommentSchema);
