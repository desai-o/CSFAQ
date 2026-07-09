const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    followableType: {
      type: String,
      enum: ["question", "tag"],
      required: true,
      index: true
    },
    followableId: {
      type: String,
      required: true,
      index: true
    },
    isMuted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

followSchema.index(
  {
    userId: 1,
    followableType: 1,
    followableId: 1
  },
  {
    unique: true
  }
);

module.exports = mongoose.model("Follow", followSchema);
