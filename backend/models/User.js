const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["student", "alumni", "moderator", "admin"],
      default: "student",
      index: true
    },
    questionsCount: {
      type: Number,
      default: 0
    },
    answersCount: {
      type: Number,
      default: 0
    },
    reputation: {
      type: Number,
      default: 0
    },
    badges: {
      type: [String],
      default: []
    },
    cohort: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ reputation: -1 });

module.exports = mongoose.model("User", userSchema);
