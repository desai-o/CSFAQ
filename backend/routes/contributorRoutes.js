const express = require("express");
const router = express.Router();
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const User = require("../models/User");
const { getPagination } = require("../utils/pagination");
const { success, fail } = require("../utils/apiResponse");

router.get("/leaderboard", async (req, res) => {
  try {
    const { limit, offset } = getPagination(req.query);

    if (isMongoAvailable()) {
      const [users, total] = await Promise.all([
        User.find()
          .sort({ reputation: -1, answersCount: -1, questionsCount: -1 })
          .skip(offset)
          .limit(limit)
          .select("-password -passwordHash"),
        User.countDocuments()
      ]);

      const formatted = users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        reputation: u.reputation || 0,
        answersCount: u.answersCount || 0,
        questionsCount: u.questionsCount || 0,
        badges: u.badges || []
      }));

      return success(res, {
        storage: "mongodb",
        data: formatted,
        meta: { pagination: { limit, offset, total } }
      });
    }

    const db = getSQLiteDb();
    const [users, totalRow] = await Promise.all([
      db.all(
        `
        SELECT id, mongo_id, name, email, role, reputation, answers_count, questions_count, badges
        FROM users
        ORDER BY reputation DESC, answers_count DESC, questions_count DESC
        LIMIT ? OFFSET ?
        `,
        limit,
        offset
      ),
      db.get("SELECT COUNT(*) AS total FROM users")
    ]);

    const formatted = users.map(u => ({
      id: u.mongo_id || String(u.id),
      name: u.name,
      email: u.email,
      role: u.role,
      reputation: u.reputation || 0,
      answersCount: u.answers_count || 0,
      questionsCount: u.questions_count || 0,
      badges: u.badges ? u.badges.split(",").filter(Boolean) : []
    }));

    return success(res, {
      storage: "sqlite",
      data: formatted,
      meta: { pagination: { limit, offset, total: totalRow.total } }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "LEADERBOARD_FAILED",
      message: "Failed to retrieve leaderboard",
      details: error.message
    });
  }
});

module.exports = router;
