const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Answer = require("../models/Answer");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const { trackEvent } = require("../services/eventService");
const { requireAuth, requireRole } = require("../middleware/auth");
const { canDeleteResource } = require("../middleware/ownership");
const { dispatchNotification } = require("../services/notificationService");
const { getPagination } = require("../utils/pagination");
const { success, fail } = require("../utils/apiResponse");
const { writeLimiter } = require("../middleware/rateLimits");
const { adjustUserStats } = require("../services/badgeService");
const { saveAnswerRevision, getAnswerRevisions, rollbackAnswer } = require("../services/revisionService");
const { createModerationRecord } = require("../services/moderationService");

const createAnswerSchema = z.object({
  body: z.object({
    questionId: z.string().trim().min(1).optional().nullable(),
    queryId: z.string().trim().min(1).optional().nullable(),
    content: z.string().trim().min(1).max(5000),
    author: z.string().trim().max(100).optional().nullable()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateAnswerSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1).max(5000).optional(),
    isAnonymous: z.boolean().optional()
  }),
  params: z.object({
    id: z.string().min(1)
  }),
  query: z.object({}).optional()
});

const verifyAnswerSchema = z.object({
  body: z.object({
    verificationNote: z.string().trim().max(1000).optional().nullable()
  }),
  params: z.object({
    id: z.string().min(1)
  }),
  query: z.object({}).optional()
});

async function validateAnswerTarget({ questionId, queryId, storage }) {
  if (storage === "mongodb") {
    if (questionId) {
      const faqExists = await FAQ.exists({ _id: questionId });
      if (!faqExists) {
        return {
          ok: false,
          statusCode: 404,
          code: "QUESTION_NOT_FOUND",
          message: "Referenced question was not found"
        };
      }
    }

    if (queryId) {
      const queryExists = await UserQuery.exists({ _id: queryId });
      if (!queryExists) {
        return {
          ok: false,
          statusCode: 404,
          code: "QUERY_NOT_FOUND",
          message: "Referenced query was not found"
        };
      }
    }

    return { ok: true };
  }

  const db = getSQLiteDb();

  if (questionId) {
    const faq = await db.get(
      `
      SELECT id
      FROM faqs
      WHERE id = ?
         OR mongo_id = ?
      `,
      questionId,
      questionId
    );

    if (!faq) {
      return {
        ok: false,
        statusCode: 404,
        code: "QUESTION_NOT_FOUND",
        message: "Referenced question was not found"
      };
    }
  }

  if (queryId) {
    const query = await db.get(
      `
      SELECT id
      FROM user_queries
      WHERE id = ?
         OR mongo_id = ?
      `,
      queryId,
      queryId
    );

    if (!query) {
      return {
        ok: false,
        statusCode: 404,
        code: "QUERY_NOT_FOUND",
        message: "Referenced query was not found"
      };
    }
  }

  return { ok: true };
}

router.post("/", requireAuth, writeLimiter, validate(createAnswerSchema), async (req, res) => {
  try {
    const { questionId, queryId, content, author } = req.body;

    if (!content || content.trim() === "") {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Answer content is required"
      });
    }

    if (!questionId && !queryId) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "questionId or queryId is required"
      });
    }

    const actorId = req.user?.id || "anonymous";
    const actorName = req.user?.name || author || "Community Member";

    const targetValidation = await validateAnswerTarget({
      questionId,
      queryId,
      storage: isMongoAvailable() ? "mongodb" : "sqlite"
    });

    if (!targetValidation.ok) {
      return fail(res, {
        statusCode: targetValidation.statusCode,
        code: targetValidation.code,
        message: targetValidation.message
      });
    }

    if (isMongoAvailable()) {
      const answer = await Answer.create({
        questionId: questionId || null,
        queryId: queryId || null,
        content: content.trim(),
        author: actorName,
        userId: actorId,
        authorName: actorName
      });

      // Run AI moderation check
      const modResult = await createModerationRecord({
        targetType: "answer",
        targetId: String(answer._id),
        text: content
      });

      if (modResult.flagged) {
        answer.moderationStatus = "needs_review";
        await answer.save();
      }

      await adjustUserStats(actorId, { answersCountDelta: 1, reputationDelta: 5 });


      await trackEvent({
        type: "answer_created",
        userId: actorId,
        targetType: "answer",
        targetId: String(answer._id),
        metadata: {
          questionId,
          queryId,
          storage: "mongodb"
        }
      });

      await dispatchNotification({
        eventType: "answer_created",
        triggeredByUserId: actorId,
        followableType: questionId ? "question" : "query",
        followableId: String(questionId || queryId),
        message: `New answer posted: "${content.substring(0, 40)}..."`
      }).catch((err) =>
        console.error("Error dispatching notification:", err)
      );

      return success(res, {
        statusCode: 201,
        storage: "mongodb",
        data: answer
      });
    }


    const db = getSQLiteDb();

    const result = await db.run(
        `
        INSERT INTO answers (
        question_id,
        query_id,
        content,
        author,
        user_id,
        author_name,
        synced_to_mongo,
        moderation_status,
        is_anonymous
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, 'approved', 0)
        `,
        questionId || null,
        queryId || null,
        content.trim(),
        actorName,
        actorId,
        actorName
      );

    // Run AI moderation check
    const modResult = await createModerationRecord({
      targetType: "answer",
      targetId: String(result.lastID),
      text: content
    });

    if (modResult.flagged) {
      await db.run("UPDATE answers SET moderation_status = 'needs_review' WHERE id = ?", result.lastID);
    }

    await adjustUserStats(actorId, { answersCountDelta: 1, reputationDelta: 5 });


    await trackEvent({
      type: "answer_created",
      userId: actorId,
      targetType: "answer",
      targetId: String(result.lastID),
      metadata: {
        questionId,
        queryId,
        storage: "sqlite"
      }
    });
    await dispatchNotification({
      eventType: "answer_created",
      triggeredByUserId: actorId,
      followableType: questionId ? "question" : "query",
      followableId: String(questionId || queryId),
      message: `New answer posted: "${content.substring(0, 40)}..."`
    }).catch((err) => console.error("Error dispatching notification:", err));

    return success(res, {
      statusCode: 201,
      storage: "sqlite",
      data: {
        id: result.lastID,
        questionId,
        queryId,
        content: content.trim(),
        author: actorName,
        votes: 0,
        isBest: false,
        moderationStatus: modResult.flagged ? "needs_review" : "approved"
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "ANSWER_CREATE_FAILED",
      message: "Failed to submit answer",
      details: error.message
    });
  }
});

router.get("/query/:queryId", async (req, res) => {
  try {
    const { queryId } = req.params;
    const { limit, offset } = getPagination(req.query);

    if (isMongoAvailable()) {
      const filter = { queryId, moderationStatus: { $nin: ["needs_review", "rejected"] } };
      const [answers, total] = await Promise.all([
        Answer.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
        Answer.countDocuments(filter)
      ]);

      await trackEvent({
        type: "query_viewed",
        userId: req.user?.id || "anonymous",
        targetType: "query",
        targetId: queryId,
        metadata: { storage: "mongodb" }
      }).catch(err => console.error("Event track failed:", err.message));

      return success(res, {
        storage: "mongodb",
        data: answers,
        meta: { pagination: { limit, offset, total } }
      });
    }

    const db = getSQLiteDb();

    const [answers, totalRow] = await Promise.all([
      db.all(
        `
        SELECT *
        FROM answers
        WHERE (question_id = ? OR query_id = ?) AND moderation_status NOT IN ('needs_review', 'rejected')
        ORDER BY created_at DESC
        LIMIT ?
        OFFSET ?
        `,
        questionId,
        questionId,
        limit,
        offset
      ),
      db.get(
        "SELECT COUNT(*) AS total FROM answers WHERE (question_id = ? OR query_id = ?) AND moderation_status NOT IN ('needs_review', 'rejected')",
        questionId,
        questionId
      )
    ]);

    await trackEvent({
      type: "query_viewed",
      userId: req.user?.id || "anonymous",
      targetType: "query",
      targetId: queryId,
      metadata: { storage: "sqlite" }
    }).catch(err => console.error("Event track failed:", err.message));

    return success(res, {
      storage: "sqlite",
      data: answers,
      meta: { pagination: { limit, offset, total: totalRow.total } }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "QUERY_ANSWERS_FETCH_FAILED",
      message: "Failed to fetch query answers",
      details: error.message
    });
  }
});

router.get("/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { limit, offset } = getPagination(req.query);

    if (isMongoAvailable()) {
      const filter = {
        $or: [{ questionId }, { queryId: questionId }],
        moderationStatus: { $nin: ["needs_review", "rejected"] }
      };
      const [answers, total] = await Promise.all([
        Answer.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
        Answer.countDocuments(filter)
      ]);

      await trackEvent({
        type: "faq_viewed",
        userId: req.user?.id || "anonymous",
        targetType: "faq",
        targetId: questionId,
        metadata: { storage: "mongodb" }
      }).catch(err => console.error("Event track failed:", err.message));

      return success(res, {
        storage: "mongodb",
        data: answers,
        meta: { pagination: { limit, offset, total } }
      });
    }

    const db = getSQLiteDb();

    const [answers, totalRow] = await Promise.all([
      db.all(
        `
        SELECT *
        FROM answers
        WHERE question_id = ? AND moderation_status NOT IN ('needs_review', 'rejected')
        ORDER BY created_at DESC
        LIMIT ?
        OFFSET ?
        `,
        questionId,
        limit,
        offset
      ),
      db.get("SELECT COUNT(*) AS total FROM answers WHERE question_id = ? AND moderation_status NOT IN ('needs_review', 'rejected')", questionId)
    ]);

    await trackEvent({
      type: "faq_viewed",
      userId: req.user?.id || "anonymous",
      targetType: "faq",
      targetId: questionId,
      metadata: { storage: "sqlite" }
    }).catch(err => console.error("Event track failed:", err.message));

    return success(res, {
      storage: "sqlite",
      data: answers,
      meta: { pagination: { limit, offset, total: totalRow.total } }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "ANSWERS_FETCH_FAILED",
      message: "Failed to fetch answers",
      details: error.message
    });
  }
});

router.delete("/:id", requireAuth, writeLimiter, async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const answer = await Answer.findById(req.params.id);

      if (!answer) {
        return fail(res, {
          statusCode: 404,
          code: "ANSWER_NOT_FOUND",
          message: "Answer not found"
        });
      }

      if (!canDeleteResource(req.user, answer)) {
        return fail(res, {
          statusCode: 403,
          code: "FORBIDDEN",
          message: "You are not allowed to delete this answer"
        });
      }

      await Answer.deleteOne({ _id: answer._id });
      await adjustUserStats(answer.userId, { answersCountDelta: -1, reputationDelta: -5 });


      return success(res, {
        storage: "mongodb",
        data: {
          deleted: true
        }
      });
    }

    const db = getSQLiteDb();

    const answer = await db.get(
      `
      SELECT *
      FROM answers
      WHERE id = ?
      `,
      req.params.id
    );

    if (!answer) {
      return fail(res, {
        statusCode: 404,
        code: "ANSWER_NOT_FOUND",
        message: "Answer not found"
      });
    }

    if (!canDeleteResource(req.user, answer)) {
      return fail(res, {
        statusCode: 403,
        code: "FORBIDDEN",
        message: "You are not allowed to delete this answer"
      });
    }

    await db.run(
      `
      DELETE FROM answers
      WHERE id = ?
      `,
      req.params.id
    );

    await adjustUserStats(answer.user_id, { answersCountDelta: -1, reputationDelta: -5 });


    return success(res, {
      storage: "sqlite",
      data: {
        deleted: true
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "ANSWER_DELETE_FAILED",
      message: "Failed to delete answer",
      details: error.message
    });
  }
});

// Edit answer
router.patch("/:id", requireAuth, writeLimiter, validate(updateAnswerSchema), async (req, res) => {
  try {
    const { content, isAnonymous } = req.body;

    if (isMongoAvailable()) {
      const answer = await Answer.findById(req.params.id);
      if (!answer) {
        return fail(res, { statusCode: 404, code: "ANSWER_NOT_FOUND", message: "Answer not found" });
      }

      if (answer.userId !== req.user.id && req.user.role !== "admin" && req.user.role !== "moderator") {
        return fail(res, { statusCode: 403, code: "FORBIDDEN", message: "Not allowed to edit this answer" });
      }

      // Save revision
      await saveAnswerRevision(answer._id, {
        content: answer.content,
        userId: req.user.id,
        authorName: req.user.name
      });

      if (content !== undefined) answer.content = content.trim();
      if (isAnonymous !== undefined) answer.isAnonymous = isAnonymous;
      await answer.save();

      return success(res, { storage: "mongodb", data: answer });
    }

    const db = getSQLiteDb();
    const answer = await db.get("SELECT * FROM answers WHERE id = ?", req.params.id);
    if (!answer) {
      return fail(res, { statusCode: 404, code: "ANSWER_NOT_FOUND", message: "Answer not found" });
    }

    if (answer.user_id !== req.user.id && req.user.role !== "admin" && req.user.role !== "moderator") {
      return fail(res, { statusCode: 403, code: "FORBIDDEN", message: "Not allowed to edit this answer" });
    }

    // Save revision
    await saveAnswerRevision(answer.id, {
      content: answer.content,
      userId: req.user.id,
      authorName: req.user.name
    });

    // Build dynamic update query
    const updates = [];
    const params = [];
    
    if (content !== undefined) {
      updates.push("content = ?");
      params.push(content.trim());
    }
    if (isAnonymous !== undefined) {
      updates.push("is_anonymous = ?");
      params.push(isAnonymous ? 1 : 0);
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    
    params.push(req.params.id);

    await db.run(
      `UPDATE answers SET ${updates.join(", ")} WHERE id = ?`,
      ...params
    );

    const updated = await db.get("SELECT * FROM answers WHERE id = ?", req.params.id);
    return success(res, { storage: "sqlite", data: updated });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "ANSWER_UPDATE_FAILED", message: error.message });
  }
});

// Verify answer
router.patch("/:id/verify", requireAuth, requireRole("moderator", "admin"), writeLimiter, validate(verifyAnswerSchema), async (req, res) => {
  try {
    const { verificationNote = "" } = req.body;
    const now = new Date();

    if (isMongoAvailable()) {
      const answer = await Answer.findById(req.params.id);
      if (!answer) {
        return fail(res, { statusCode: 404, code: "ANSWER_NOT_FOUND", message: "Answer not found" });
      }

      answer.isVerified = true;
      answer.verifiedBy = req.user.id;
      answer.verifiedAt = now;
      answer.verificationNote = verificationNote;
      await answer.save();

      // Adjust reputation of answer author (+15)
      await adjustUserStats(answer.userId, { reputationDelta: 15 });

      await trackEvent({
        type: "answer_verified",
        userId: req.user.id,
        targetType: "answer",
        targetId: String(answer._id),
        metadata: { verificationNote }
      });

      // Dispatch notifications
      const authorUserId = answer.userId;
      if (authorUserId && authorUserId !== req.user.id) {
        await Notification.create({
          userId: String(authorUserId),
          message: `Your answer was verified by an expert!`,
          eventType: "answer_verified",
          followableType: "answer",
          followableId: String(answer._id)
        }).catch(err => console.error("Notification creation failed:", err));
      }

      await dispatchNotification({
        eventType: "answer_verified",
        triggeredByUserId: req.user.id,
        followableType: answer.questionId ? "question" : "query",
        followableId: String(answer.questionId || answer.queryId),
        message: `An answer to a question you follow was verified!`
      }).catch(err => console.error("Notification dispatch failed:", err));

      return success(res, { storage: "mongodb", data: answer });
    }

    const db = getSQLiteDb();
    const answer = await db.get("SELECT * FROM answers WHERE id = ?", req.params.id);
    if (!answer) {
      return fail(res, { statusCode: 404, code: "ANSWER_NOT_FOUND", message: "Answer not found" });
    }

    const verifiedAtStr = now.toISOString();

    await db.run(
      `
      UPDATE answers
      SET is_verified = 1,
          verified_by = ?,
          verified_at = ?,
          verification_note = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      req.user.id,
      verifiedAtStr,
      verificationNote,
      req.params.id
    );

    // Adjust reputation of answer author (+15)
    await adjustUserStats(answer.user_id, { reputationDelta: 15 });

    await trackEvent({
      type: "answer_verified",
      userId: req.user.id,
      targetType: "answer",
      targetId: String(req.params.id),
      metadata: { verificationNote }
    });

    const authorUserId = answer.user_id;
    if (authorUserId && authorUserId !== req.user.id) {
      await db.run(
        `
        INSERT INTO notifications (
          user_id, message, event_type, followable_type, followable_id, is_read
        )
        VALUES (?, ?, 'answer_verified', 'answer', ?, 0)
        `,
        String(authorUserId),
        `Your answer was verified by an expert!`,
        String(req.params.id)
      ).catch(err => console.error("Notification creation failed:", err));
    }

    await dispatchNotification({
      eventType: "answer_verified",
      triggeredByUserId: req.user.id,
      followableType: answer.question_id ? "question" : "query",
      followableId: String(answer.question_id || answer.query_id),
      message: `An answer to a question you follow was verified!`
    }).catch(err => console.error("Notification dispatch failed:", err));

    const updated = await db.get("SELECT * FROM answers WHERE id = ?", req.params.id);
    return success(res, { storage: "sqlite", data: updated });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "ANSWER_VERIFY_FAILED", message: error.message });
  }
});

// Get answer revisions
router.get("/:id/revisions", async (req, res) => {
  try {
    const revisions = await getAnswerRevisions(req.params.id);
    return success(res, { data: revisions });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "GET_REVISIONS_FAILED", message: error.message });
  }
});

// Rollback answer
router.post("/:id/revisions/:revisionId/rollback", requireAuth, requireRole("moderator", "admin"), async (req, res) => {
  try {
    const rolledBack = await rollbackAnswer(req.params.id, req.params.revisionId, req.user);
    return success(res, { data: rolledBack });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "ROLLBACK_FAILED", message: error.message });
  }
});

module.exports = router;

