const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Follow = require("../models/Follow");

async function autoFollow(userId, followableType, followableId) {
  if (!userId || userId === "anonymous" || !followableType || !followableId) {
    return null;
  }

  if (!["question", "tag"].includes(followableType)) {
    return null;
  }

  try {
    if (isMongoAvailable()) {
      const existing = await Follow.findOne({
        userId,
        followableType,
        followableId: String(followableId)
      });

      if (existing) return existing;

      return await Follow.create({
        userId,
        followableType,
        followableId: String(followableId)
      });
    }

    const db = getSQLiteDb();

    const existing = await db.get(
      `
      SELECT *
      FROM follows
      WHERE user_id = ?
        AND followable_type = ?
        AND followable_id = ?
      `,
      userId,
      followableType,
      String(followableId)
    );

    if (existing) return existing;

    const result = await db.run(
      `
      INSERT INTO follows (
        user_id,
        followable_type,
        followable_id
      )
      VALUES (?, ?, ?)
      `,
      userId,
      followableType,
      String(followableId)
    );

    return {
      id: result.lastID,
      userId,
      followableType,
      followableId: String(followableId),
      isMuted: false
    };
  } catch (error) {
    console.error("Failed to auto-follow:", error.message);
    return null;
  }
}

async function getFollowers(followableType, followableId) {
  if (isMongoAvailable()) {
    return Follow.find({
      followableType,
      followableId: String(followableId),
      isMuted: false
    });
  }

  const db = getSQLiteDb();

  return db.all(
    `
    SELECT *
    FROM follows
    WHERE followable_type = ?
      AND followable_id = ?
      AND is_muted = 0
    `,
    followableType,
    String(followableId)
  );
}

module.exports = {
  autoFollow,
  getFollowers
};
