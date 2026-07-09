const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: "anonymous"
    },
    questionId: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

bookmarkSchema.index({ userId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model("Bookmark", bookmarkSchema);
