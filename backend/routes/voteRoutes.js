const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Vote = require("../models/Vote");
const Answer = require("../models/Answer");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const { trackEvent } = require("../services/eventService");
const { requireAuth } = require("../middleware/auth");
const { success, fail } = require("../utils/apiResponse");
const { writeLimiter } = require("../middleware/rateLimits");

// `questionType` is required for question votes. The server used to try both
// the FAQ and UserQuery collections when applying a vote ("cross-collection
// fall-through"). That hidden coupling made it easy to bump the wrong counter,
// so we now require the caller to tell us which collection the question lives
// in: `"faq"` for an FAQ or `"query"` for a community-submitted UserQuery.
const voteSchema = z.object({
  body: z.object({
    targetType: z.enum(["question", "answer"]),
    targetId: z.string().trim().min(1).max(100),
    value: z.union([z.literal(1), z.literal(-1)]).optional(),
    questionType: z.enum(["faq", "query"]).optional()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

/**
 * Increment / decrement the cached upvote count on an FAQ document.
 *
 * Pattern mirrors the UserQuery helper below — both are inspired by the
 * original FAQ upvotes logic, but each is dedicated to a single collection
 * so we never accidentally bump the wrong counter.
 *
 * MongoDB uses `$inc` with a positive or negative delta. SQLite uses a
 * single UPDATE statement with MAX(..., 0) so we never drop below 0.
 * Returns the new count, or null if the row could not be found.
 */
async function adjustFaqUpvotes(targetId, delta) {
  if (delta === 0) return null;

  if (isMongoAvailable()) {
    const updated = await FAQ.findByIdAndUpdate(
      targetId,
      { $inc: { upvotes: delta } },
      { new: true }
    );

    if (updated && typeof updated.upvotes === "number") {
      // Defensive floor at 0 — `$inc` would happily go negative.
      if (updated.upvotes < 0) {
        updated.upvotes = 0;
        await updated.save();
      }
      return updated.upvotes;
    }

    return null;
  }

  const db = getSQLiteDb();
  const result = await db.run(
    `
    UPDATE faqs
    SET upvotes = MAX(0, COALESCE(upvotes, 0) + ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      OR CAST(id AS TEXT) = ?
    `,
    delta,
    targetId,
    String(targetId)
  );

  if (result.changes > 0) {
    const row = await db.get(
      "SELECT upvotes FROM faqs WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
      targetId,
      String(targetId)
    );
    return row?.upvotes ?? null;
  }

  return null;
}

/**
 * Increment / decrement the cached upvote count on a UserQuery document.
 *
 * This is the new "community questions" upvote helper, intentionally a
 * sibling of `adjustFaqUpvotes` rather than a fall-through from it.
 * The two helpers share an identical structure so that fixing a bug in
 * one is a one-line mirror in the other.
 *
 * Returns the new count, or null if the row could not be found.
 */
async function adjustUserQueryUpvotes(targetId, delta) {
  if (delta === 0) return null;

  if (isMongoAvailable()) {
    const updated = await UserQuery.findByIdAndUpdate(
      targetId,
      { $inc: { upvotes: delta } },
      { new: true }
    );

    if (updated && typeof updated.upvotes === "number") {
      // Defensive floor at 0 — `$inc` would happily go negative.
      if (updated.upvotes < 0) {
        updated.upvotes = 0;
        await updated.save();
      }
      return updated.upvotes;
    }

    return null;
  }

  const db = getSQLiteDb();
  const result = await db.run(
    `
    UPDATE user_queries
    SET upvotes = MAX(0, COALESCE(upvotes, 0) + ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      OR CAST(id AS TEXT) = ?
    `,
    delta,
    targetId,
    String(targetId)
  );

  if (result.changes > 0) {
    const row = await db.get(
      "SELECT upvotes FROM user_queries WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
      targetId,
      String(targetId)
    );
    return row?.upvotes ?? null;
  }

  return null;
}

/**
 * Read the current cached upvote count for a question of a known type.
 * Mirrors the adjust* helpers above so the read path matches the write path.
 * Returns the current count, or null if the row could not be found.
 */
async function readQuestionUpvotes(questionType, targetId) {
  if (isMongoAvailable()) {
    if (questionType === "faq") {
      const faq = await FAQ.findById(targetId);
      return faq?.upvotes ?? null;
    }
    const q = await UserQuery.findById(targetId);
    return q?.upvotes ?? null;
  }

  const db = getSQLiteDb();
  if (questionType === "faq") {
    const row = await db.get(
      "SELECT upvotes FROM faqs WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
      targetId,
      String(targetId)
    );
    return row?.upvotes ?? null;
  }
  const row = await db.get(
    "SELECT upvotes FROM user_queries WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
    targetId,
    String(targetId)
  );
  return row?.upvotes ?? null;
}

/**
 * Dispatch a +1/-1 adjustment to the correct question collection based on
 * `questionType`. Returns the new count, or null if the row could not be
 * found in the requested collection.
 */
async function adjustQuestionUpvotes(questionType, targetId, delta) {
  if (questionType === "faq") return adjustFaqUpvotes(targetId, delta);
  if (questionType === "query") return adjustUserQueryUpvotes(targetId, delta);
  return null;
}

router.post("/", requireAuth, writeLimiter, validate(voteSchema), async (req, res) => {
  try {
    const {
      targetType,
      targetId,
      value = 1,
      questionType
    } = req.body;

    const userId = req.user.id;

    if (!targetType || !targetId) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "targetType and targetId are required"
      });
    }

    if (!["question", "answer"].includes(targetType)) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "targetType must be question or answer"
      });
    }

    // For question votes, the caller MUST tell us which collection the
    // question lives in. We no longer guess (cross-collection fall-through
    // was removed because it masked bugs and could bump the wrong counter).
    if (targetType === "question" && !["faq", "query"].includes(questionType)) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "questionType is required for question votes and must be 'faq' or 'query'"
      });
    }

    if (isMongoAvailable()) {
      const existing = await Vote.findOne({ userId, targetType, targetId });

      if (existing) {
        await Vote.deleteOne({ _id: existing._id });

        if (targetType === "answer") {
          await Answer.findByIdAndUpdate(targetId, { $inc: { votes: -existing.value } });
        } else {
          // Persist the count on the FAQ/UserQuery so it survives a reload.
          await adjustQuestionUpvotes(questionType, targetId, -existing.value);
        }

        await trackEvent({
          type: "vote_removed",
          userId,
          targetType,
          targetId,
          metadata: {
            storage: "mongodb"
          }
        });

        // Read the current count back so the client can sync.
        const currentCount = targetType === "question"
          ? await readQuestionUpvotes(questionType, targetId)
          : await (async () => {
              const ans = await Answer.findById(targetId);
              return ans?.votes ?? null;
            })();

        return success(res, {
          storage: "mongodb",
          data: existing,
          meta: { action: "removed", targetType, voteCount: currentCount }
        });
      }

      const vote = await Vote.create({
        userId,
        targetType,
        targetId,
        value
      });

      if (targetType === "answer") {
        await Answer.findByIdAndUpdate(targetId, { $inc: { votes: value } });
      } else {
        // Persist the count on the FAQ/UserQuery so it survives a reload.
        await adjustQuestionUpvotes(questionType, targetId, value);
      }

      await trackEvent({
        type: "vote_created",
        userId,
        targetType,
        targetId,
        metadata: {
          storage: "mongodb",
          value
        }
      });

      // Read the current count back so the client can sync.
      const currentCount = targetType === "question"
        ? await readQuestionUpvotes(questionType, targetId)
        : await (async () => {
            const ans = await Answer.findById(targetId);
            return ans?.votes ?? null;
          })();

      return success(res, {
        statusCode: 201,
        storage: "mongodb",
        data: vote,
        meta: { action: "created", targetType, voteCount: currentCount }
      });
    }

    const db = getSQLiteDb();

    const existing = await db.get(
      `
      SELECT *
      FROM votes
      WHERE user_id = ?
        AND target_type = ?
        AND target_id = ?
      `,
      userId,
      targetType,
      targetId
    );

    if (existing) {
      await db.run(
        `
        DELETE FROM votes
        WHERE id = ?
        `,
        existing.id
      );

      if (targetType === "answer") {
        await db.run(
          `
          UPDATE answers
          SET votes = COALESCE(votes, 0) - ?
          WHERE id = ?
          `,
          existing.value,
          targetId
        );
      } else {
        // Persist the count on the FAQ/UserQuery so it survives a reload.
        await adjustQuestionUpvotes(questionType, targetId, -existing.value);
      }

      await trackEvent({
        type: "vote_removed",
        userId,
        targetType,
        targetId,
        metadata: {
          storage: "sqlite"
        }
      });

      // Read the current count back so the client can sync.
      const currentCount = targetType === "question"
        ? await readQuestionUpvotes(questionType, targetId)
        : await (async () => {
            const row = await db.get("SELECT votes FROM answers WHERE id = ?", targetId);
            return row?.votes ?? null;
          })();

      return success(res, {
        storage: "sqlite",
        data: existing,
        meta: { action: "removed", targetType, voteCount: currentCount }
      });
    }

    const result = await db.run(
      `
      INSERT INTO votes (
        user_id,
        target_type,
        target_id,
        value,
        synced_to_mongo
      )
      VALUES (?, ?, ?, ?, 0)
      `,
      userId,
      targetType,
      targetId,
      value
    );

    if (targetType === "answer") {
      await db.run(
        `
        UPDATE answers
        SET votes = COALESCE(votes, 0) + ?
        WHERE id = ?
        `,
        value,
        targetId
      );
    } else {
      // Persist the count on the FAQ/UserQuery so it survives a reload.
      await adjustQuestionUpvotes(questionType, targetId, value);
    }

    await trackEvent({
      type: "vote_created",
      userId,
      targetType,
      targetId,
      metadata: {
        storage: "sqlite",
        value
      }
    });

    // Read the current count back so the client can sync.
    const currentCount = targetType === "question"
      ? await readQuestionUpvotes(questionType, targetId)
      : await (async () => {
          const row = await db.get("SELECT votes FROM answers WHERE id = ?", targetId);
          return row?.votes ?? null;
        })();

    return success(res, {
      statusCode: 201,
      storage: "sqlite",
      data: {
        id: result.lastID,
        userId,
        targetType,
        targetId,
        value
      },
      meta: { action: "created", targetType, voteCount: currentCount }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "VOTE_PROCESSING_FAILED",
      message: "Failed to process vote",
      details: error.message
    });
  }
});

module.exports = router;
