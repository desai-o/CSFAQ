const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Bookmark = require("../models/Bookmark");
const { trackEvent } = require("../services/eventService");
const { requireAuth } = require("../middleware/auth");
const { getPagination } = require("../utils/pagination");
const { success, fail } = require("../utils/apiResponse");
const { writeLimiter } = require("../middleware/rateLimits");

const bookmarkSchema = z.object({
  body: z.object({
    questionId: z.string().trim().min(1).max(100)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

router.post("/", requireAuth, writeLimiter, validate(bookmarkSchema), async (req, res) => {
  try {
    const { questionId } = req.body;
    const userId = req.user.id;

    if (!questionId) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "questionId is required"
      });
    }

    if (isMongoAvailable()) {
      const existing = await Bookmark.findOne({ userId, questionId });

      if (existing) {
        await Bookmark.deleteOne({ _id: existing._id });

        await trackEvent({
          type: "bookmark_removed",
          userId,
          targetType: "question",
          targetId: questionId,
          metadata: {
            storage: "mongodb"
          }
        });

        return success(res, {
          storage: "mongodb",
          data: existing,
          meta: { action: "removed" }
        });
      }

      const bookmark = await Bookmark.create({ userId, questionId });

      await trackEvent({
        type: "bookmark_created",
        userId,
        targetType: "question",
        targetId: questionId,
        metadata: {
          storage: "mongodb"
        }
      });

      return success(res, {
        statusCode: 201,
        storage: "mongodb",
        data: bookmark,
        meta: { action: "created" }
      });
    }

    const db = getSQLiteDb();

    const existing = await db.get(
      `
      SELECT *
      FROM bookmarks
      WHERE user_id = ?
        AND question_id = ?
      `,
      userId,
      questionId
    );

    if (existing) {
      await db.run(
        `
        DELETE FROM bookmarks
        WHERE id = ?
        `,
        existing.id
      );

      await trackEvent({
        type: "bookmark_removed",
        userId,
        targetType: "question",
        targetId: questionId,
        metadata: {
          storage: "sqlite"
        }
      });

      return success(res, {
        storage: "sqlite",
        data: existing,
        meta: { action: "removed" }
      });
    }

    const result = await db.run(
      `
      INSERT INTO bookmarks (
        user_id,
        question_id,
        synced_to_mongo
      )
      VALUES (?, ?, 0)
      `,
      userId,
      questionId
    );

    await trackEvent({
      type: "bookmark_created",
      userId,
      targetType: "question",
      targetId: questionId,
      metadata: {
        storage: "sqlite"
      }
    });

    return success(res, {
      statusCode: 201,
      storage: "sqlite",
      data: {
        id: result.lastID,
        userId,
        questionId
      },
      meta: { action: "created" }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "BOOKMARK_PROCESSING_FAILED",
      message: "Failed to process bookmark",
      details: error.message
    });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset } = getPagination(req.query);

    if (isMongoAvailable()) {
      const [bookmarks, total] = await Promise.all([
        Bookmark.find({ userId }).skip(offset).limit(limit),
        Bookmark.countDocuments({ userId })
      ]);

      return success(res, {
        storage: "mongodb",
        data: bookmarks,
        meta: { pagination: { limit, offset, total } }
      });
    }

    const db = getSQLiteDb();

    const [bookmarks, totalRow] = await Promise.all([
      db.all(
        `
        SELECT *
        FROM bookmarks
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        OFFSET ?
        `,
        userId,
        limit,
        offset
      ),
      db.get("SELECT COUNT(*) AS total FROM bookmarks WHERE user_id = ?", userId)
    ]);

    return success(res, {
      storage: "sqlite",
      data: bookmarks,
      meta: { pagination: { limit, offset, total: totalRow.total } }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "BOOKMARKS_FETCH_FAILED",
      message: "Failed to fetch bookmarks",
      details: error.message
    });
  }
});

module.exports = router;
