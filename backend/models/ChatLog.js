const mongoose = require("mongoose");

const chatLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: "anonymous",
      index: true
    },
    message: {
      type: String,
      required: true
    },
    response: {
      type: String,
      required: true
    },
    retrievedFaqs: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ChatLog", chatLogSchema);
