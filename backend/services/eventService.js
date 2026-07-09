const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Event = require("../models/Event");

async function trackEvent({
  type,
  userId = "anonymous",
  targetType = "",
  targetId = "",
  metadata = {}
}) {
  try {
    if (isMongoAvailable()) {
      return await Event.create({
        type,
        userId,
        targetType,
        targetId,
        metadata
      });
    }

    const db = getSQLiteDb();

    await db.run(
      `
      INSERT INTO events (
        type,
        user_id,
        target_type,
        target_id,
        metadata,
        synced_to_mongo
      )
      VALUES (?, ?, ?, ?, ?, 0)
      `,
      type,
      userId,
      targetType,
      targetId,
      JSON.stringify(metadata || {})
    );
  } catch (error) {
    console.error("Failed to track event:", error.message);
  }

  return null;
}

module.exports = {
  trackEvent
};
