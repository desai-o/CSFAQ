const mongoose = require("mongoose");

const queryRevisionSchema = new mongoose.Schema(
  {
    queryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserQuery",
      required: true,
      index: true
    },
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
    category: {
      type: String,
      default: "General",
      trim: true
    },
    tags: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      default: "pending"
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

module.exports = mongoose.model("QueryRevision", queryRevisionSchema);
