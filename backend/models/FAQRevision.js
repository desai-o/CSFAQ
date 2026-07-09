const mongoose = require("mongoose");

const faqRevisionSchema = new mongoose.Schema(
  {
    faqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FAQ",
      required: true,
      index: true
    },
    question: {
      type: String,
      required: true,
      trim: true
    },
    answer: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: "General",
      trim: true
    },
    tags: {
      type: [String],
      default: []
    },
    userId: {
      type: String,
      default: "anonymous"
    },
    authorName: {
      type: String,
      default: "Anonymous"
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

module.exports = mongoose.model("FAQRevision", faqRevisionSchema);
