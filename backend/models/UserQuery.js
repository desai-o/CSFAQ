const mongoose = require("mongoose");

const userQuerySchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    answer: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending"
    },
    source: {
      type: String,
      default: "frontend"
    },
    category: {
      type: String,
      default: "General",
      trim: true,
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    upvotes: {
      type: Number,
      default: 0,
      min: 0,
      index: true
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
      index: true
    },
    userId: {
      type: String,
      default: "anonymous",
      index: true
    },
    authorName: {
      type: String,
      default: "Anonymous"
    },
    promoted: {
      type: Boolean,
      default: false
    },
    moderationStatus: {
      type: String,
      default: "approved",
      enum: ["auto_clear", "needs_review", "escalated", "approved", "rejected"]
    }
  },
  {
    timestamps: true
  }
);

userQuerySchema.index(
  {
    question: "text",
    description: "text",
    answer: "text",
    category: "text",
    tags: "text"
  },
  {
    weights: {
      question: 10,
      category: 6,
      tags: 5,
      description: 3,
      answer: 2
    }
  }
);

userQuerySchema.index({ category: 1, status: 1 });
userQuerySchema.index({ userId: 1, createdAt: -1 });
userQuerySchema.index({ upvotes: -1, createdAt: -1 });

module.exports = mongoose.model("UserQuery", userQuerySchema);
