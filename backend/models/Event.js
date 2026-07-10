const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "question_created",
        "answer_created",
        "vote_created",
        "vote_removed",
        "bookmark_created",
        "bookmark_removed",
        "faq_created",
        "search_performed"
      ],
      required: true
    },
    userId: {
      type: String,
      default: "anonymous"
    },
    targetType: {
      type: String,
      default: ""
    },
    targetId: {
      type: String,
      default: ""
    },
    metadata: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

eventSchema.index({ type: 1, createdAt: -1 });
eventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Event", eventSchema);
