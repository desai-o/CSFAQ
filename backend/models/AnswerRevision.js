const mongoose = require("mongoose");

const answerRevisionSchema = new mongoose.Schema(
  {
    answerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Answer",
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true
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

module.exports = mongoose.model("AnswerRevision", answerRevisionSchema);
