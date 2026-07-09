const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const UserQuery = require("../models/UserQuery");
const { enqueueSyncPipeline, extractKeywords } = require("../services/syncService");
const { trackEvent } = require("../services/eventService");
const { autoFollow } = require("../services/followService");
const { dispatchNotification } = require("../services/notificationService");
const { inferCategory, normalizeTags } = require("../services/categoryService");
const { requireAuth, requireRole } = require("../middleware/auth");
const { canDeleteResource } = require("../middleware/ownership");
const { getPagination } = require("../utils/pagination");
const { success, fail } = require("../utils/apiResponse");
const { writeLimiter } = require("../middleware/rateLimits");
const { adjustUserStats } = require("../services/badgeService");
const { saveQueryRevision } = require("../services/revisionService");
const { createModerationRecord } = require("../services/moderationService");
const { shouldRecordView } = require("../services/viewDedupeService");

const createQuerySchema = z.object({
  body: z.object({
    question: z.string().min(3).max(500),
    answer: z.string().max(3000).optional(),
    description: z.string().max(3000).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
    upvotes: z.number().int().min(0).max(1000000).optional()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateQuerySchema = z.object({
  body: z.object({
    question: z.string().min(3).max(500).optional(),
    description: z.string().max(3000).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).min(1).max(10).optional(),
    upvotes: z.number().int().min(0).max(1000000).optional()
  }),
  params: z.object({
    id: z.string().min(1)
  }),
  query: z.object({}).optional()
});

const resolveQuerySchema = z.object({
  body: z.object({
    answer: z.string().min(1).max(3000)
  }),
  params: z.object({
    id: z.string().min(1)
  }),
  query: z.object({}).optional()
});


router.post("/", writeLimiter, validate(createQuerySchema), async (req, res) => {
  try {
    const { question, answer, description, category, tags, upvotes } = req.body;

    const inferredCategory =
      category || inferCategory(`${question || ""} ${description || ""} ${answer || ""}`);

    const normalizedTags = normalizeTags(tags || []);

    if (!question || question.trim() === "") {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Question is required"
      });
    }

    if (question.length > 500) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Question must be 500 characters or less"
      });
    }

    if (answer && answer.length > 3000) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Answer must be 3000 characters or less"
      });
    }

    if (isMongoAvailable()) {
      const query = await UserQuery.create({
        question: question.trim(),
        description: description ? description.trim() : "",
        answer: answer ? answer.trim() : "",
        category: inferredCategory,
        tags: normalizedTags,
        upvotes: Number.isFinite(upvotes) ? upvotes : 0,
        userId: req.user?.id || "anonymous",
        authorName: req.user?.name || "Anonymous",
        status: answer ? "resolved" : "pending",
        source: "frontend"
      });

      // Run AI moderation check
      const modResult = await createModerationRecord({
        targetType: "query",
        targetId: String(query._id),
        text: `${question} ${description || ""}`
      });

      if (modResult.flagged) {
        query.moderationStatus = "needs_review";
        await query.save();
      }

      await adjustUserStats(req.user?.id, { questionsCountDelta: 1, reputationDelta: 2 });
      if (answer) {
        await adjustUserStats(req.user?.id, { answersCountDelta: 1, reputationDelta: 5 });
      }


      await trackEvent({
        type: answer ? "faq_created" : "question_created",
        userId: req.user?.id || "anonymous",
        targetType: "query",
        targetId: String(query._id),
        metadata: {
          storage: "mongodb",
          hasAnswer: Boolean(answer)
        }
      });

      enqueueSyncPipeline();

      await autoFollow(
        req.user?.id,
        'question',
        query.id || query._id.toString()
      );

      const keywords = extractKeywords(`${question.trim()}`);
      for (const tag of keywords) {
        await dispatchNotification({
          eventType: 'new_question',
          triggeredByUserId: req.user?.id || "anonymous",
          followableType: 'tag',
          followableId: tag,
          message: `New question under #${tag}: ${question.substring(0, 50)}`
        });
      }

      return success(res, {
        statusCode: 201,
        storage: "mongodb",
        data: query
      });
    }

    const db = getSQLiteDb();

    const result = await db.run(
      `
      INSERT INTO user_queries (
        question,
        answer,
        description,
        category,
        tags,
        upvotes,
        user_id,
        author_name,
        status,
        source,
        synced_to_mongo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      question.trim(),
      answer ? answer.trim() : "",
      description ? description.trim() : "",
      inferredCategory,
      normalizedTags.join(","),
      Number.isFinite(upvotes) ? upvotes : 0,
      req.user?.id || "anonymous",
      req.user?.name || "Anonymous",
      answer ? "resolved" : "pending",
      "frontend"
    );

    // Run AI moderation check
    const modResult = await createModerationRecord({
      targetType: "query",
      targetId: String(result.lastID),
      text: `${question} ${description || ""}`
    });

    if (modResult.flagged) {
      await db.run("UPDATE user_queries SET moderation_status = 'needs_review' WHERE id = ?", result.lastID);
    }

    await adjustUserStats(req.user?.id, { questionsCountDelta: 1, reputationDelta: 2 });
    if (answer) {
      await adjustUserStats(req.user?.id, { answersCountDelta: 1, reputationDelta: 5 });
    }


    await trackEvent({
      type: answer ? "faq_created" : "question_created",
      userId: req.user?.id || "anonymous",
      targetType: "query",
      targetId: String(result.lastID),
      metadata: {
        storage: "sqlite",
        hasAnswer: Boolean(answer)
      }
    });

    enqueueSyncPipeline();

    await autoFollow(
      req.user?.id,
      'question',
      result.lastID
    );

    const keywords = extractKeywords(`${question.trim()}`);
    for (const tag of keywords) {
      await dispatchNotification({
        eventType: 'new_question',
        triggeredByUserId: req.user?.id || "anonymous",
        followableType: 'tag',
        followableId: tag,
        message: `New question under #${tag}: ${question.substring(0, 50)}`
      });
    }

    return success(res, {
      statusCode: 201,
      storage: "sqlite",
      data: {
        id: result.lastID,
        question: question.trim(),
        answer: answer ? answer.trim() : "",
        status: answer ? "resolved" : "pending",
        moderationStatus: modResult.flagged ? "needs_review" : "approved"
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "QUERY_CREATE_FAILED",
      message: "Failed to save query",
      details: error.message
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { limit, offset } = getPagination(req.query);

    if (isMongoAvailable()) {
      const filter = { moderationStatus: { $nin: ["needs_review", "rejected"] } };
      const [queries, total] = await Promise.all([
        UserQuery.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
        UserQuery.countDocuments(filter)
      ]);

      return success(res, {
        storage: "mongodb",
        data: queries,
        meta: { pagination: { limit, offset, total } }
      });
    }

    const db = getSQLiteDb();

    const [queries, totalRow] = await Promise.all([
      db.all(
        `
        SELECT *
        FROM user_queries
        WHERE moderation_status NOT IN ('needs_review', 'rejected')
        ORDER BY created_at DESC
        LIMIT ?
        OFFSET ?
        `,
        limit,
        offset
      ),
      db.get("SELECT COUNT(*) AS total FROM user_queries WHERE moderation_status NOT IN ('needs_review', 'rejected')")
    ]);

    return success(res, {
      storage: "sqlite",
      data: queries,
      meta: { pagination: { limit, offset, total: totalRow.total } }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "QUERIES_FETCH_FAILED",
      message: "Failed to fetch queries",
      details: error.message
    });
  }
});

// Increment the view counter when someone opens a query's detail page.
// Mirror of POST /faqs/:id/view but for unresolved user queries.
// Dedupes per viewer (auth user > x-anonymous-id > IP) over a sliding
// window (VIEW_DEDUPE_WINDOW_MS, default 30 min) so the counter reflects
// distinct opens rather than HTTP request volume from reloads / reopens.
router.post("/:id/view", async (req, res) => {
  try {
    const { record } = shouldRecordView({
      targetType: "query",
      targetId: req.params.id,
      req
    });

    if (isMongoAvailable()) {
      let query = null;
      try {
        query = await UserQuery.findById(req.params.id);
      } catch (castError) {
        query = await UserQuery.findOne({ id: req.params.id });
      }

      if (!query) {
        return fail(res, { statusCode: 404, code: "QUERY_NOT_FOUND", message: "Query not found" });
      }

      let views = query.views || 0;
      if (record) {
        query.views = views + 1;
        await query.save();
        views = query.views;
        await trackEvent({
          type: "query_viewed",
          userId: req.user?.id || "anonymous",
          targetType: "query",
          targetId: String(query._id || req.params.id),
          metadata: { storage: "mongodb" }
        });
      }

      return success(res, {
        storage: "mongodb",
        data: { views, deduped: !record }
      });
    }

    const db = getSQLiteDb();
    const existing = await db.get(
      `SELECT id, views FROM user_queries WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1`,
      req.params.id,
      req.params.id
    );

    if (!existing) {
      return fail(res, { statusCode: 404, code: "QUERY_NOT_FOUND", message: "Query not found" });
    }

    let views = existing.views || 0;
    if (record) {
      await db.run(
        `UPDATE user_queries SET views = COALESCE(views, 0) + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? OR CAST(id AS TEXT) = ?`,
        req.params.id,
        req.params.id
      );

      const updatedRow = await db.get(
        `SELECT views FROM user_queries WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1`,
        req.params.id,
        req.params.id
      );
      views = updatedRow?.views || 0;

      await trackEvent({
        type: "query_viewed",
        userId: req.user?.id || "anonymous",
        targetType: "query",
        targetId: String(existing.id),
        metadata: { storage: "sqlite" }
      });
    }

    return success(res, {
      storage: "sqlite",
      data: { views, deduped: !record }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "QUERY_VIEW_FAILED",
      message: "Failed to increment view count",
      details: error.message
    });
  }
});

router.patch("/:id/resolve", writeLimiter, validate(resolveQuerySchema), async (req, res) => {
  try {
    const { answer } = req.body;

    if (!answer || answer.trim() === "") {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Answer is required to resolve query"
      });
    }

    if (answer.length > 3000) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Answer must be 3000 characters or less"
      });
    }

    if (isMongoAvailable()) {
      const query = await UserQuery.findByIdAndUpdate(
        req.params.id,
        {
          answer: answer.trim(),
          status: "resolved",
          promoted: false
        },
        {
          new: true
        }
      );

      if (!query) {
        return fail(res, {
          statusCode: 404,
          code: "QUERY_NOT_FOUND",
          message: "Query not found"
        });
      }

      await adjustUserStats(req.user?.id, { answersCountDelta: 1, reputationDelta: 5 });


      enqueueSyncPipeline();

      await autoFollow(
        req.user?.id,
        'question',
        query.id || query._id.toString()
      );

      const username = req.user?.name || "Someone";
      await dispatchNotification({
        eventType: 'question_answered',
        triggeredByUserId: req.user?.id || "anonymous",
        followableType: 'question',
        followableId: req.params.id,
        message: `${username} answered / commented on: ${query.question.substring(0, 50)}`
      });

      return success(res, {
        storage: "mongodb",
        data: query
      });
    }

    const db = getSQLiteDb();

    const result = await db.run(
      `
      UPDATE user_queries
      SET answer = ?,
          status = 'resolved',
          promoted = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      answer.trim(),
      req.params.id
    );

    if (result.changes === 0) {
      return fail(res, {
        statusCode: 404,
        code: "QUERY_NOT_FOUND",
        message: "Query not found"
      });
    }

    await adjustUserStats(req.user?.id, { answersCountDelta: 1, reputationDelta: 5 });


    enqueueSyncPipeline();

    const updated = await db.get(
      `
      SELECT *
      FROM user_queries
      WHERE id = ?
      `,
      req.params.id
    );

    await autoFollow(
      req.user?.id,
      'question',
      req.params.id
    );

    const username = req.user?.name || "Someone";
    await dispatchNotification({
      eventType: 'question_answered',
      triggeredByUserId: req.user?.id || "anonymous",
      followableType: 'question',
      followableId: req.params.id,
      message: `${username} answered / commented on: ${updated.question.substring(0, 50)}`
    });

    return success(res, {
      storage: "sqlite",
      data: updated
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "QUERY_RESOLVE_FAILED",
      message: "Failed to resolve query",
      details: error.message
    });
  }
});

router.delete("/:id", requireAuth, writeLimiter, async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const query = await UserQuery.findById(req.params.id);

      if (!query) {
        return fail(res, {
          statusCode: 404,
          code: "QUERY_NOT_FOUND",
          message: "Query not found"
        });
      }

      if (!canDeleteResource(req.user, query)) {
        return fail(res, {
          statusCode: 403,
          code: "FORBIDDEN",
          message: "You are not allowed to delete this query"
        });
      }

      await UserQuery.deleteOne({ _id: query._id });
      await adjustUserStats(query.userId, { questionsCountDelta: -1, reputationDelta: -2 });


      return success(res, {
        storage: "mongodb",
        data: {
          deleted: true
        }
      });
    }

    const db = getSQLiteDb();

    const query = await db.get(
      `
      SELECT *
      FROM user_queries
      WHERE id = ?
      `,
      req.params.id
    );

    if (!query) {
      return fail(res, {
        statusCode: 404,
        code: "QUERY_NOT_FOUND",
        message: "Query not found"
      });
    }

    if (!canDeleteResource(req.user, query)) {
      return fail(res, {
        statusCode: 403,
        code: "FORBIDDEN",
        message: "You are not allowed to delete this query"
      });
    }

    await db.run(
      `
      DELETE FROM user_queries
      WHERE id = ?
      `,
      req.params.id
    );

    await adjustUserStats(query.user_id, { questionsCountDelta: -1, reputationDelta: -2 });


    return success(res, {
      storage: "sqlite",
      data: {
        deleted: true
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "QUERY_DELETE_FAILED",
      message: "Failed to delete query",
      details: error.message
    });
  }
});

// Edit UserQuery
router.patch("/:id", requireAuth, writeLimiter, validate(updateQuerySchema), async (req, res) => {
  try {
    const { question, description, category, tags, upvotes } = req.body;

    if (isMongoAvailable()) {
      const query = await UserQuery.findById(req.params.id);
      if (!query) {
        return fail(res, { statusCode: 404, code: "QUERY_NOT_FOUND", message: "Query not found" });
      }

      if (query.userId !== req.user.id && req.user.role !== "admin" && req.user.role !== "moderator") {
        return fail(res, { statusCode: 403, code: "FORBIDDEN", message: "Not allowed to edit this query" });
      }

      // Save revision
      await saveQueryRevision(query._id, {
        question: query.question,
        description: query.description,
        answer: query.answer,
        category: query.category,
        tags: query.tags,
        status: query.status,
        userId: req.user.id,
        authorName: req.user.name
      });

      if (question !== undefined) query.question = question.trim();
      if (description !== undefined) query.description = description.trim();
      if (category !== undefined) query.category = category.trim();
      if (tags !== undefined) query.tags = tags;
      if (upvotes !== undefined) query.upvotes = upvotes;
      await query.save();

      return success(res, { storage: "mongodb", data: query });
    }

    const db = getSQLiteDb();
    const query = await db.get("SELECT * FROM user_queries WHERE id = ?", req.params.id);
    if (!query) {
      return fail(res, { statusCode: 404, code: "QUERY_NOT_FOUND", message: "Query not found" });
    }

    if (query.user_id !== req.user.id && req.user.role !== "admin" && req.user.role !== "moderator") {
      return fail(res, { statusCode: 403, code: "FORBIDDEN", message: "Not allowed to edit this query" });
    }

    // Save revision
    await saveQueryRevision(query.id, {
      question: query.question,
      description: query.description,
      answer: query.answer,
      category: query.category,
      tags: query.tags,
      status: query.status,
      userId: req.user.id,
      authorName: req.user.name
    });

    const updatedQuestion = question !== undefined ? question.trim() : query.question;
    const updatedDescription = description !== undefined ? description.trim() : query.description;
    const updatedCategory = category !== undefined ? category.trim() : query.category;
    const updatedTags = tags !== undefined ? tags.join(",") : query.tags;
    const updatedUpvotes = upvotes !== undefined ? upvotes : query.upvotes;

    await db.run(
      `
      UPDATE user_queries
      SET question = ?,
          description = ?,
          category = ?,
          tags = ?,
          upvotes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      updatedQuestion,
      updatedDescription,
      updatedCategory,
      updatedTags,
      updatedUpvotes,
      req.params.id
    );

    const updated = await db.get("SELECT * FROM user_queries WHERE id = ?", req.params.id);
    return success(res, { storage: "sqlite", data: updated });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "QUERY_UPDATE_FAILED", message: error.message });
  }
});

// Get a single query by id (used by the detail page to confirm the
// persisted `views` counter after incrementing it).
router.get("/:id", async (req, res) => {
  try {
    if (isMongoAvailable()) {
      let query = null;
      try {
        query = await UserQuery.findById(req.params.id);
      } catch (castError) {
        query = await UserQuery.findOne({ id: req.params.id });
      }

      if (!query) {
        return fail(res, { statusCode: 404, code: "QUERY_NOT_FOUND", message: "Query not found" });
      }

      return success(res, {
        storage: "mongodb",
        data: query
      });
    }

    const db = getSQLiteDb();
    const query = await db.get(
      `SELECT * FROM user_queries WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1`,
      req.params.id,
      req.params.id
    );

    if (!query) {
      return fail(res, { statusCode: 404, code: "QUERY_NOT_FOUND", message: "Query not found" });
    }

    return success(res, {
      storage: "sqlite",
      data: query
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "QUERY_FETCH_FAILED",
      message: "Failed to fetch query",
      details: error.message
    });
  }
});

// Get query revisions
router.get("/:id/revisions", async (req, res) => {
  try {
    const { getQueryRevisions } = require("../services/revisionService");
    const revisions = await getQueryRevisions(req.params.id);
    return success(res, { data: revisions });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "GET_REVISIONS_FAILED", message: error.message });
  }
});

module.exports = router;

