const mongoose = require("mongoose");

const searchAnalyticSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      default: "anonymous",
      index: true
    },
    resultsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SearchAnalytic", searchAnalyticSchema);
