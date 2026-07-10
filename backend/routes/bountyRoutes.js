const express = require("express");
const router = express.Router();
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Bounty = require("../models/Bounty");
const Answer = require("../models/Answer");
const UserQuery = require("../models/UserQuery");
const { requireAuth } = require("../middleware/auth");
const { success, fail } = require("../utils/apiResponse");
const { adjustUserStats } = require("../services/badgeService");

// POST /api/bounties - Create a bounty on a query
router.post("/", requireAuth, async (req, res) => {
  try {
    const { queryId, amount, durationDays } = req.body;
    if (!queryId || !amount || amount <= 0) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "queryId and positive amount are required"
      });
    }

    const duration = durationDays || 7;
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    const creatorId = req.user.id;

    // Verify creator has enough reputation
    // If Mongo is down, check SQLite user
    let userRep = 0;
    const db = getSQLiteDb();

    if (isMongoAvailable()) {
      const User = require("../models/User");
      const user = await User.findById(creatorId);
      userRep = user ? user.reputation : 0;
    } else {
      const user = await db.get("SELECT reputation FROM users WHERE id = ? OR mongo_id = ?", creatorId, creatorId);
      userRep = user ? user.reputation : 0;
    }

    if (userRep < amount) {
      return fail(res, {
        statusCode: 400,
        code: "INSUFFICIENT_REPUTATION",
        message: `You need at least ${amount} reputation to create this bounty. Your current reputation is ${userRep}.`
      });
    }

    let savedBounty = null;

    if (isMongoAvailable()) {
      const bounty = new Bounty({
        queryId,
        amount,
        createdBy: creatorId,
        expiresAt,
        status: "open"
      });
      savedBounty = await bounty.save();
    }

    // Deduct creator reputation
    await adjustUserStats(creatorId, { reputationDelta: -amount });

    const mongoIdStr = savedBounty ? String(savedBounty._id) : null;
    const result = await db.run(
      `
      INSERT INTO bounties (mongo_id, query_id, amount, created_by, status, expires_at)
      VALUES (?, ?, ?, ?, 'open', ?)
      `,
      mongoIdStr,
      String(queryId),
      amount,
      creatorId,
      expiresAt.toISOString()
    );

    return success(res, {
      statusCode: 201,
      data: {
        id: mongoIdStr || String(result.lastID),
        queryId,
        amount,
        createdBy: creatorId,
        expiresAt,
        status: "open"
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "BOUNTY_CREATE_FAILED",
      message: "Failed to create bounty",
      details: error.message
    });
  }
});

// POST /api/bounties/:id/award - Award bounty to an answer
router.post("/:id/award", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { answerId } = req.body;

    if (!answerId) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "answerId is required to award the bounty"
      });
    }

    const db = getSQLiteDb();
    let bounty = null;

    if (isMongoAvailable()) {
      bounty = await Bounty.findById(id);
    } else {
      bounty = await db.get("SELECT * FROM bounties WHERE id = ? OR mongo_id = ?", id, id);
    }

    if (!bounty) {
      return fail(res, {
        statusCode: 404,
        code: "BOUNTY_NOT_FOUND",
        message: "Bounty not found"
      });
    }

    const status = bounty.status || bounty.status;
    if (status !== "open") {
      return fail(res, {
        statusCode: 400,
        code: "BOUNTY_ALREADY_CLOSED",
        message: "Bounty is not open"
      });
    }

    // Verify answer author to award reputation
    let answerAuthorId = null;
    if (isMongoAvailable()) {
      const answer = await Answer.findById(answerId);
      answerAuthorId = answer ? answer.userId : null;
    } else {
      const answer = await db.get("SELECT user_id FROM answers WHERE id = ? OR mongo_id = ?", answerId, answerId);
      answerAuthorId = answer ? answer.user_id : null;
    }

    if (!answerAuthorId) {
      return fail(res, {
        statusCode: 404,
        code: "ANSWER_NOT_FOUND",
        message: "Referenced answer not found"
      });
    }

    const bountyAmount = bounty.amount;

    if (isMongoAvailable()) {
      bounty.status = "closed";
      bounty.winnerId = answerAuthorId;
      bounty.winnerAnswerId = answerId;
      await bounty.save();
    }

    // Award answer author reputation
    await adjustUserStats(answerAuthorId, { reputationDelta: bountyAmount });

    // SQLite update
    await db.run(
      `
      UPDATE bounties
      SET status = 'closed', winner_id = ?, winner_answer_id = ?
      WHERE id = ? OR mongo_id = ?
      `,
      answerAuthorId,
      String(answerId),
      id,
      id
    );

    return success(res, {
      message: `Bounty of ${bountyAmount} reputation awarded to user ${answerAuthorId}`
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "BOUNTY_AWARD_FAILED",
      message: "Failed to award bounty",
      details: error.message
    });
  }
});

// GET /api/bounties - List open bounties
router.get("/", async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const bounties = await Bounty.find({ status: "open" }).sort({ createdAt: -1 });
      return success(res, {
        storage: "mongodb",
        data: bounties
      });
    }

    const db = getSQLiteDb();
    const bounties = await db.all("SELECT * FROM bounties WHERE status = 'open' ORDER BY created_at DESC");

    return success(res, {
      storage: "sqlite",
      data: bounties.map(b => ({
        id: b.mongo_id || String(b.id),
        queryId: b.query_id,
        amount: b.amount,
        createdBy: b.created_by,
        status: b.status,
        expiresAt: b.expires_at,
        createdAt: b.created_at
      }))
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "BOUNTIES_FETCH_FAILED",
      message: "Failed to fetch open bounties",
      details: error.message
    });
  }
});

module.exports = router;
