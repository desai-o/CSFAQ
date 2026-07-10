const mongoose = require("mongoose");

const moderationRecordSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      required: true,
      enum: ["faq", "query", "answer"]
    },
    targetId: {
      type: String,
      required: true,
      index: true
    },
    flagged: {
      type: Boolean,
      default: false
    },
    confidence: {
      type: Number,
      default: 0.0
    },
    categories: {
      type: [String],
      default: []
    },
    reason: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      default: "needs_review",
      enum: ["auto_clear", "needs_review", "escalated", "approved", "rejected"]
    },
    reviewedBy: {
      type: String,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    auditTrail: {
      type: [
        {
          action: String,
          actor: String,
          timestamp: { type: Date, default: Date.now },
          note: String
        }
      ],
      default: []
    }
  },
  {
    timestamps: true
  }
);

moderationRecordSchema.index({ status: 1, targetType: 1 });

module.exports = mongoose.model("ModerationRecord", moderationRecordSchema);
