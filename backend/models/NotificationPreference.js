const mongoose = require("mongoose");

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    inAppNotifications: {
      type: Boolean,
      default: true
    },
    digestFrequency: {
      type: String,
      default: "none",
      enum: ["none", "daily", "weekly"]
    },
    tagPreferences: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("NotificationPreference", notificationPreferenceSchema);
