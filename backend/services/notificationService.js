const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Notification = require("../models/Notification");
const { getFollowers } = require("./followService");

async function dispatchNotification(eventConfig) {
  const {
    eventType,
    triggeredByUserId,
    followableType,
    followableId,
    message
  } = eventConfig;

  if (!followableType || !followableId || !message) return;

  try {
    const followers = await getFollowers(followableType, followableId);

    for (const follower of followers) {
      const targetUserId = follower.userId || follower.user_id;

      if (!targetUserId) continue;

      if (triggeredByUserId && String(targetUserId) === String(triggeredByUserId)) {
        continue;
      }

      if (isMongoAvailable()) {
        await Notification.create({
          userId: String(targetUserId),
          followId: String(follower._id || follower.id || ""),
          message,
          eventType: eventType || "",
          followableType,
          followableId: String(followableId)
        });
      } else {
        const db = getSQLiteDb();

        await db.run(
          `
          INSERT INTO notifications (
            user_id,
            follow_id,
            message,
            event_type,
            followable_type,
            followable_id,
            is_read
          )
          VALUES (?, ?, ?, ?, ?, ?, 0)
          `,
          String(targetUserId),
          follower.id || null,
          message,
          eventType || "",
          followableType,
          String(followableId)
        );
      }
    }
  } catch (error) {
    console.error("Failed to dispatch notifications:", error.message);
  }
}

module.exports = {
  dispatchNotification
};
