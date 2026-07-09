const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    followId: {
      type: String,
      default: null
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    eventType: {
      type: String,
      default: ""
    },
    followableType: {
      type: String,
      default: ""
    },
    followableId: {
      type: String,
      default: ""
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
