const mongoose = require("mongoose");

const learningPathSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    createdBy: {
      type: String,
      default: "anonymous",
      index: true
    },
    items: [
      {
        faqId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FAQ",
          required: true
        },
        position: {
          type: Number,
          required: true
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("LearningPath", learningPathSchema);
