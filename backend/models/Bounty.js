const mongoose = require("mongoose");

const bountySchema = new mongoose.Schema(
  {
    queryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserQuery",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      default: 0
    },
    createdBy: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      default: "open",
      enum: ["open", "closed", "expired"]
    },
    winnerId: {
      type: String,
      default: null
    },
    winnerAnswerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Answer",
      default: null
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Bounty", bountySchema);
