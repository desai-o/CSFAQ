const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Follow = require("../models/Follow");
const { requireAuth } = require("../middleware/auth");
const { success, fail } = require("../utils/apiResponse");
const { writeLimiter } = require("../middleware/rateLimits");

const followSchema = z.object({
  body: z.object({
    followableType: z.enum(["question", "tag"]),
    followableId: z.string().trim().min(1).max(100)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

function normalizeRow(row) {
  return {
    id: row.id || row._id,
    userId: row.userId || row.user_id,
    followableType: row.followableType || row.followable_type,
    followableId: row.followableId || row.followable_id,
    isMuted: Boolean(row.isMuted ?? row.is_muted),
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at
  };
}

// GET /api/follows?type=question|tag
// Returns all follow records owned by the authenticated user.
// Optionally filtered by `type` query parameter.
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const type = req.query.type;

    if (type && !["question", "tag"].includes(String(type))) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "type must be 'question' or 'tag'"
      });
    }

    if (isMongoAvailable()) {
      const filter = { userId };
      if (type) filter.followableType = String(type);
      const docs = await Follow.find(filter).sort({ createdAt: -1 });
      return success(res, {
        storage: "mongodb",
        data: docs.map((d) => ({
          id: d._id,
          userId: d.userId,
          followableType: d.followableType,
          followableId: d.followableId,
          isMuted: Boolean(d.isMuted),
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        }))
      });
    }

    const db = getSQLiteDb();
    const params = [userId];
    let where = "WHERE user_id = ?";
    if (type) {
      where += " AND followable_type = ?";
      params.push(String(type));
    }
    const rows = await db.all(
      `SELECT * FROM follows ${where} ORDER BY datetime(created_at) DESC`,
      ...params
    );
    return success(res, {
      storage: "sqlite",
      data: rows.map(normalizeRow)
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "FOLLOW_LIST_FAILED",
      message: "Failed to load follows",
      details: error.message
    });
  }
});

// GET /api/follows/feed
// Returns questions/FAQs that match the current user's followed tags or
// followed question IDs. Used by the Subscription page.
router.get("/feed", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    let tagFollows = [];
    let questionFollows = [];

    if (isMongoAvailable()) {
      const docs = await Follow.find({ userId });
      for (const d of docs) {
        if (d.followableType === "tag") tagFollows.push(String(d.followableId));
        else if (d.followableType === "question") questionFollows.push(String(d.followableId));
      }
    } else {
      const db = getSQLiteDb();
      const rows = await db.all(
        `SELECT followable_type, followable_id FROM follows WHERE user_id = ?`,
        userId
      );
      for (const r of rows) {
        const t = r.followable_type || r.followableType;
        const id = r.followable_id || r.followableId;
        if (t === "tag") tagFollows.push(String(id));
        else if (t === "question") questionFollows.push(String(id));
      }
    }

    const normalizedTags = Array.from(
      new Set(tagFollows.map((t) => t.toLowerCase()))
    );

    const matched = [];

    // Helper: read a single query row by id
    const db = !isMongoAvailable() ? getSQLiteDb() : null;

    // 1. Followed question IDs -> always include them as their own items
    for (const qid of questionFollows) {
      try {
        if (isMongoAvailable()) {
          const UserQuery = require("../models/UserQuery");
          const FAQ = require("../models/FAQ");
          try {
            const q = await UserQuery.findById(qid);
            if (q) {
              matched.push(normalizeQueryForFeed(q, { reason: "followed_question" }));
              continue;
            }
          } catch (castError) {
            // Not a valid ObjectId for UserQuery; fall through to FAQ lookup.
          }
          try {
            const f = await FAQ.findById(qid);
            if (f) {
              matched.push(normalizeFaqForFeed(f, { reason: "followed_question" }));
              continue;
            }
          } catch (castError) {
            // Not a valid ObjectId for FAQ either; skip silently.
          }
        } else if (db) {
          const row = await db.get(
            `SELECT * FROM user_queries WHERE mongo_id = ? OR id = ? LIMIT 1`,
            qid,
            qid
          );
          if (row) {
            matched.push(normalizeQueryRowForFeed(row, { reason: "followed_question" }));
            continue;
          }
          const faq = await db.get(
            `SELECT * FROM faqs WHERE mongo_id = ? OR id = ? LIMIT 1`,
            qid,
            qid
          );
          if (faq) {
            matched.push(normalizeFaqRowForFeed(faq, { reason: "followed_question" }));
            continue;
          }
        }
      } catch (err) {
        // skip individual failures
        console.warn("feed: skipped followed question", qid, err.message);
      }
    }

    // 2. Followed tags -> include any query/FAQ that mentions them
    if (normalizedTags.length > 0) {
      try {
        if (isMongoAvailable()) {
          const UserQuery = require("../models/UserQuery");
          const FAQ = require("../models/FAQ");

          const tagRegexes = normalizedTags.map(
            (t) => new RegExp(`(^|[\\s,])${escapeRegex(t)}`, "i")
          );

          const queryMatches = await UserQuery.find({
            $or: [
              { tags: { $in: normalizedTags } },
              { tags: { $in: normalizedTags.map((t) => new RegExp(`^${escapeRegex(t)}$`, "i")) } },
              { hashtags: { $in: normalizedTags } },
              { hashtags: { $in: normalizedTags.map((t) => new RegExp(`^${escapeRegex(t)}$`, "i")) } }
            ]
          })
            .sort({ createdAt: -1 })
            .limit(50);

          for (const q of queryMatches) {
            matched.push(normalizeQueryForFeed(q, { reason: "matched_tag" }));
          }

          const faqMatches = await FAQ.find({
            $or: [
              { tags: { $in: normalizedTags } },
              { tags: { $in: normalizedTags.map((t) => new RegExp(`^${escapeRegex(t)}$`, "i")) } },
              { keywords: { $in: normalizedTags } }
            ]
          })
            .sort({ createdAt: -1 })
            .limit(50);

          for (const f of faqMatches) {
            matched.push(normalizeFaqForFeed(f, { reason: "matched_tag" }));
          }
        } else if (db) {
          const likeClauses = normalizedTags.map(() => "LOWER(tags) LIKE ?").join(" OR ");
          const likeParams = normalizedTags.map((t) => `%"${t}"%`);

          const queryRows = await db.all(
            `SELECT * FROM user_queries
             WHERE ${likeClauses}
             ORDER BY datetime(created_at) DESC
             LIMIT 50`,
            ...likeParams
          );
          for (const r of queryRows) {
            matched.push(normalizeQueryRowForFeed(r, { reason: "matched_tag" }));
          }

          const faqRows = await db.all(
            `SELECT * FROM faqs
             WHERE ${likeClauses}
             ORDER BY datetime(created_at) DESC
             LIMIT 50`,
            ...likeParams
          );
          for (const r of faqRows) {
            matched.push(normalizeFaqRowForFeed(r, { reason: "matched_tag" }));
          }
        }
      } catch (err) {
        console.warn("feed: tag matching failed", err.message);
      }
    }

    return success(res, {
      storage: isMongoAvailable() ? "mongodb" : "sqlite",
      data: {
        tags: tagFollows,
        questionIds: questionFollows,
        items: matched
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "FOLLOW_FEED_FAILED",
      message: "Failed to build follow feed",
      details: error.message
    });
  }
});

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTagsField(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    return raw
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeQueryForFeed(q, meta = {}) {
  return {
    id: String(q._id || q.id),
    title: q.question || q.title || "",
    description: q.description || "",
    category: q.category || "General",
    tags: parseTagsField(q.tags ?? q.hashtags),
    upvotes: q.upvotes ?? q.votes ?? 0,
    views: q.views ?? 0,
    status: q.status || "pending",
    createdAt: q.createdAt || q.created_at,
    sourceType: "query",
    reason: meta.reason || "matched_tag"
  };
}

function normalizeFaqForFeed(f, meta = {}) {
  return {
    id: String(f._id || f.id),
    title: f.question || f.title || "",
    answer: f.answer || "",
    category: f.category || "General",
    tags: parseTagsField(f.tags ?? f.keywords),
    upvotes: f.upvotes ?? f.votes ?? 0,
    views: f.views ?? 0,
    createdAt: f.createdAt || f.created_at,
    sourceType: "faq",
    reason: meta.reason || "matched_tag"
  };
}

function normalizeQueryRowForFeed(row, meta = {}) {
  return normalizeQueryForFeed(
    {
      id: row.id,
      _id: row.mongo_id || row.id,
      question: row.question,
      description: row.description,
      category: row.category,
      tags: row.tags,
      upvotes: row.upvotes,
      views: row.views,
      status: row.status,
      createdAt: row.created_at
    },
    meta
  );
}

function normalizeFaqRowForFeed(row, meta = {}) {
  return normalizeFaqForFeed(
    {
      id: row.id,
      _id: row.mongo_id || row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
      tags: row.tags,
      keywords: row.keywords,
      upvotes: row.upvotes,
      views: row.views,
      createdAt: row.created_at
    },
    meta
  );
}

router.post("/", requireAuth, writeLimiter, validate(followSchema), async (req, res) => {
  try {
    const { followableType, followableId } = req.body;
    const userId = req.user.id;

    if (!followableType || !followableId) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "followableType and followableId are required"
      });
    }

    if (!["question", "tag"].includes(followableType)) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "followableType must be question or tag"
      });
    }

    if (isMongoAvailable()) {
      const existing = await Follow.findOne({
        userId,
        followableType,
        followableId: String(followableId)
      });

      if (existing) {
        return fail(res, {
          statusCode: 409,
          code: "ALREADY_FOLLOWING",
          message: "Already following"
        });
      }

      const follow = await Follow.create({
        userId,
        followableType,
        followableId: String(followableId)
      });

      return success(res, {
        statusCode: 201,
        storage: "mongodb",
        data: follow
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

    if (existing) {
      return fail(res, {
        statusCode: 409,
        code: "ALREADY_FOLLOWING",
        message: "Already following"
      });
    }

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

    return success(res, {
      statusCode: 201,
      storage: "sqlite",
      data: {
        id: result.lastID,
        userId,
        followableType,
        followableId: String(followableId),
        isMuted: false
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "FOLLOW_CREATE_FAILED",
      message: "Failed to create follow",
      details: error.message
    });
  }
});

router.delete("/:id", requireAuth, writeLimiter, async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const result = await Follow.deleteOne({
        _id: req.params.id,
        userId: req.user.id
      });

      if (result.deletedCount === 0) {
        return fail(res, {
          statusCode: 404,
          code: "FOLLOW_NOT_FOUND",
          message: "Follow record not found"
        });
      }

      return success(res, {
        storage: "mongodb",
        data: {
          deleted: true
        }
      });
    }

    const db = getSQLiteDb();

    const result = await db.run(
      `
      DELETE FROM follows
      WHERE id = ?
        AND user_id = ?
      `,
      req.params.id,
      req.user.id
    );

    if (result.changes === 0) {
      return fail(res, {
        statusCode: 404,
        code: "FOLLOW_NOT_FOUND",
        message: "Follow record not found"
      });
    }

    return success(res, {
      storage: "sqlite",
      data: {
        deleted: true
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "FOLLOW_DELETE_FAILED",
      message: "Failed to unfollow",
      details: error.message
    });
  }
});

router.patch("/:id/mute", requireAuth, writeLimiter, async (req, res) => {
  try {
    const { isMuted } = req.body;

    if (isMongoAvailable()) {
      const follow = await Follow.findOneAndUpdate(
        {
          _id: req.params.id,
          userId: req.user.id
        },
        {
          isMuted: Boolean(isMuted)
        },
        {
          new: true
        }
      );

      if (!follow) {
        return fail(res, {
          statusCode: 404,
          code: "FOLLOW_NOT_FOUND",
          message: "Follow record not found"
        });
      }

      return success(res, {
        storage: "mongodb",
        data: follow
      });
    }

    const db = getSQLiteDb();

    const result = await db.run(
      `
      UPDATE follows
      SET is_muted = ?
      WHERE id = ?
        AND user_id = ?
      `,
      isMuted ? 1 : 0,
      req.params.id,
      req.user.id
    );

    if (result.changes === 0) {
      return fail(res, {
        statusCode: 404,
        code: "FOLLOW_NOT_FOUND",
        message: "Follow record not found"
      });
    }

    return success(res, {
      storage: "sqlite",
      data: {
        id: req.params.id,
        isMuted: Boolean(isMuted)
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "FOLLOW_MUTE_FAILED",
      message: "Failed to mute follow",
      details: error.message
    });
  }
});

module.exports = router;
