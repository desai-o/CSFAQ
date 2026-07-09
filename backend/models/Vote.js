const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: "anonymous"
    },
    targetType: {
      type: String,
      enum: ["question", "answer"],
      required: true
    },
    targetId: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      enum: [1, -1],
      default: 1
    }
  },
  {
    timestamps: true
  }
);

voteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model("Vote", voteSchema);
