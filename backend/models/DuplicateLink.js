const mongoose = require("mongoose");

const duplicateLinkSchema = new mongoose.Schema(
  {
    sourceId: {
      type: String,
      required: true,
      index: true
    },
    targetId: {
      type: String,
      required: true,
      index: true
    },
    similarity: {
      type: Number,
      default: 0.0
    },
    explanation: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "confirmed", "rejected"]
    }
  },
  {
    timestamps: true
  }
);

duplicateLinkSchema.index({ sourceId: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model("DuplicateLink", duplicateLinkSchema);
