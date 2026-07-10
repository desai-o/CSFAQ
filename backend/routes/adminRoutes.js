const express = require("express");
const router = express.Router();

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const UserQuery = require("../models/UserQuery");
const FAQ = require("../models/FAQ");
const Answer = require("../models/Answer");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);
router.use(requireRole("moderator", "admin"));

router.get("/pending-queries", async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const queries = await UserQuery.find({
        status: "pending"
      }).sort({
        createdAt: -1
      });

      return res.json({
        status: "success",
        storage: "mongodb",
        data: queries
      });
    }

    const db = getSQLiteDb();

    const queries = await db.all(`
      SELECT *
      FROM user_queries
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);

    return res.json({
      status: "success",
      storage: "sqlite",
      data: queries
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "ADMIN_PENDING_QUERIES_FAILED",
      message: "Failed to fetch pending queries",
      details: error.message
    });
  }
});

router.get("/overview", async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const [users, faqs, queries, answers] = await Promise.all([
        User.countDocuments(),
        FAQ.countDocuments(),
        UserQuery.countDocuments(),
        Answer.countDocuments()
      ]);

      return res.json({
        status: "success",
        storage: "mongodb",
        data: {
          users,
          faqs,
          queries,
          answers
        }
      });
    }

    const db = getSQLiteDb();

    const users = await db.get("SELECT COUNT(*) AS count FROM users");
    const faqs = await db.get("SELECT COUNT(*) AS count FROM faqs");
    const queries = await db.get("SELECT COUNT(*) AS count FROM user_queries");
    const answers = await db.get("SELECT COUNT(*) AS count FROM answers");

    return res.json({
      status: "success",
      storage: "sqlite",
      data: {
        users: users.count,
        faqs: faqs.count,
        queries: queries.count,
        answers: answers.count
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "ADMIN_OVERVIEW_FAILED",
      message: "Failed to fetch admin overview",
      details: error.message
    });
  }
});

// Manual trigger for relevance decay calculation
router.post("/relevance-decay", async (req, res) => {
  try {
    const { runRelevanceDecayJob } = require("../services/decayService");
    await runRelevanceDecayJob();
    return res.json({
      status: "success",
      message: "Relevance decay calculation completed successfully"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "DECAY_CALCULATION_FAILED",
      message: "Failed to calculate relevance decay",
      details: error.message
    });
  }
});

// Retrieve list of FAQs that need updates (stale / flagged)
router.get("/needs-update", async (req, res) => {
  try {
    // Run decay scoring beforehand so the list is always fresh
    const { runRelevanceDecayJob } = require("../services/decayService");
    await runRelevanceDecayJob().catch(err => console.error("Decay job failed during fetch:", err.message));

    if (isMongoAvailable()) {
      const faqs = await FAQ.find({ needsUpdate: true }).sort({ staleScore: -1 });
      return res.json({
        status: "success",
        storage: "mongodb",
        data: faqs
      });
    }

    const db = getSQLiteDb();
    const faqs = await db.all(
      `
      SELECT *
      FROM faqs
      WHERE needs_update = 1
      ORDER BY stale_score DESC
      `
    );

    return res.json({
      status: "success",
      storage: "sqlite",
      data: faqs
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "NEEDS_UPDATE_FETCH_FAILED",
      message: "Failed to fetch needs-update list",
      details: error.message
    });
  }
});

// GET /api/admin/moderation-queue
router.get("/moderation-queue", async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const ModerationRecord = require("../models/ModerationRecord");
      const records = await ModerationRecord.find({
        status: { $in: ["needs_review", "escalated"] }
      }).sort({ createdAt: -1 });

      return res.json({
        status: "success",
        storage: "mongodb",
        data: records
      });
    }

    const db = getSQLiteDb();
    const records = await db.all(
      `
      SELECT *
      FROM moderation_records
      WHERE status IN ('needs_review', 'escalated')
      ORDER BY created_at DESC
      `
    );

    const parsedRecords = records.map(r => ({
      ...r,
      flagged: !!r.flagged,
      categories: r.categories ? JSON.parse(r.categories) : [],
      auditTrail: r.audit_trail ? JSON.parse(r.audit_trail) : []
    }));

    return res.json({
      status: "success",
      storage: "sqlite",
      data: parsedRecords
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "MODERATION_QUEUE_FETCH_FAILED",
      message: "Failed to fetch moderation queue",
      details: error.message
    });
  }
});

// GET /api/admin/moderation/:id/explanation
router.get("/moderation/:id/explanation", async (req, res) => {
  try {
    const { id } = req.params;

    if (isMongoAvailable()) {
      const ModerationRecord = require("../models/ModerationRecord");
      const record = await ModerationRecord.findById(id);
      if (!record) {
        return res.status(404).json({
          status: "error",
          code: "MODERATION_RECORD_NOT_FOUND",
          message: "Moderation record not found"
        });
      }

      return res.json({
        status: "success",
        storage: "mongodb",
        data: {
          flagged: record.flagged,
          confidence: record.confidence,
          categories: record.categories,
          reason: record.reason
        }
      });
    }

    const db = getSQLiteDb();
    const record = await db.get("SELECT * FROM moderation_records WHERE id = ? OR mongo_id = ?", id, id);
    if (!record) {
      return res.status(404).json({
        status: "error",
        code: "MODERATION_RECORD_NOT_FOUND",
        message: "Moderation record not found"
      });
    }

    return res.json({
      status: "success",
      storage: "sqlite",
      data: {
        flagged: !!record.flagged,
        confidence: record.confidence,
        categories: record.categories ? JSON.parse(record.categories) : [],
        reason: record.reason
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "MODERATION_EXPLANATION_FAILED",
      message: "Failed to fetch moderation explanation",
      details: error.message
    });
  }
});

// PATCH /api/admin/moderation/:id/action
router.patch("/moderation/:id/action", async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // action: approve, reject, escalate

    if (!["approve", "reject", "escalate"].includes(action)) {
      return res.status(400).json({
        status: "error",
        code: "INVALID_MODERATION_ACTION",
        message: "Action must be approve, reject, or escalate"
      });
    }

    let status = "needs_review";
    let moderationStatus = "needs_review";
    if (action === "approve") {
      status = "approved";
      moderationStatus = "approved";
    } else if (action === "reject") {
      status = "rejected";
      moderationStatus = "rejected";
    } else if (action === "escalate") {
      status = "escalated";
      moderationStatus = "escalated";
    }

    let record = null;
    const actor = req.user.email || req.user.id || "moderator";

    if (isMongoAvailable()) {
      const ModerationRecord = require("../models/ModerationRecord");
      record = await ModerationRecord.findById(id);
      if (record) {
        record.status = status;
        record.reviewedBy = actor;
        record.reviewedAt = new Date();
        record.auditTrail.push({
          action,
          actor,
          timestamp: new Date(),
          note: note || `Action: ${action}`
        });
        await record.save();

        // Propagate status to target
        const targetId = record.targetId;
        if (record.targetType === "faq") {
          await FAQ.findByIdAndUpdate(targetId, { moderationStatus });
        } else if (record.targetType === "query") {
          await UserQuery.findByIdAndUpdate(targetId, { moderationStatus });
        } else if (record.targetType === "answer") {
          await Answer.findByIdAndUpdate(targetId, { moderationStatus });
        }
      }
    }

    // SQLite update
    const db = getSQLiteDb();
    const existing = await db.get("SELECT * FROM moderation_records WHERE id = ? OR mongo_id = ?", id, id);
    if (!existing) {
      return res.status(404).json({
        status: "error",
        code: "MODERATION_RECORD_NOT_FOUND",
        message: "Moderation record not found"
      });
    }

    const trail = existing.audit_trail ? JSON.parse(existing.audit_trail) : [];
    trail.push({
      action,
      actor,
      timestamp: new Date().toISOString(),
      note: note || `Action: ${action}`
    });

    await db.run(
      `
      UPDATE moderation_records
      SET status = ?, reviewed_by = ?, reviewed_at = ?, audit_trail = ?
      WHERE id = ? OR mongo_id = ?
      `,
      status,
      actor,
      new Date().toISOString(),
      JSON.stringify(trail),
      id,
      id
    );

    // Propagate moderation_status to matching SQLite content table
    const targetType = existing.target_type;
    const targetId = existing.target_id;
    if (targetType === "faq") {
      await db.run("UPDATE faqs SET moderation_status = ? WHERE id = ? OR mongo_id = ?", moderationStatus, targetId, targetId);
    } else if (targetType === "query") {
      await db.run("UPDATE user_queries SET moderation_status = ? WHERE id = ? OR mongo_id = ?", moderationStatus, targetId, targetId);
    } else if (targetType === "answer") {
      await db.run("UPDATE answers SET moderation_status = ? WHERE id = ? OR mongo_id = ?", moderationStatus, targetId, targetId);
    }

    return res.json({
      status: "success",
      message: `Moderation record ${action}d successfully`
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "MODERATION_ACTION_FAILED",
      message: "Failed to apply moderation action",
      details: error.message
    });
  }
});

// GET /api/admin/knowledge-gaps
router.get("/knowledge-gaps", async (req, res) => {
  try {
    const db = getSQLiteDb();

    // 1. Failed searches (searches with 0 results)
    let failedSearches = [];
    if (isMongoAvailable()) {
      const SearchAnalytic = require("../models/SearchAnalytic");
      failedSearches = await SearchAnalytic.aggregate([
        { $match: { resultsCount: 0 } },
        { $group: { _id: "$query", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).then(res => res.map(r => ({ query: r._id, count: r.count })));
    } else {
      const rows = await db.all(
        `
        SELECT query, COUNT(*) as count
        FROM search_analytics
        WHERE results_count = 0
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
        `
      );
      failedSearches = rows.map(r => ({ query: r.query, count: r.count }));
    }

    // 2. Unanswered queries (user_queries in pending state with no answers)
    let unansweredQueries = [];
    if (isMongoAvailable()) {
      // Find all queries that have no matching answers
      const allAnswers = await Answer.find({ queryId: { $ne: null } });
      const queryIdsWithAnswers = new Set(allAnswers.map(a => String(a.queryId)));
      const queries = await UserQuery.find({ status: "pending" });
      unansweredQueries = queries.filter(q => !queryIdsWithAnswers.has(String(q._id)));
    } else {
      unansweredQueries = await db.all(
        `
        SELECT *
        FROM user_queries
        WHERE status = 'pending'
          AND id NOT IN (SELECT DISTINCT query_id FROM answers WHERE query_id IS NOT NULL)
        ORDER BY created_at DESC
        `
      );
    }

    // 3. Stale FAQ content
    let staleFAQs = [];
    if (isMongoAvailable()) {
      staleFAQs = await FAQ.find({ needsUpdate: true }).sort({ staleScore: -1 }).limit(10);
    } else {
      staleFAQs = await db.all(
        `
        SELECT *
        FROM faqs
        WHERE needs_update = 1
        ORDER BY stale_score DESC
        LIMIT 10
        `
      );
    }

    return res.json({
      status: "success",
      data: {
        failedSearches,
        unansweredQueries,
        staleFAQs
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "KNOWLEDGE_GAPS_FAILED",
      message: "Failed to compile knowledge gaps",
      details: error.message
    });
  }
});

module.exports = router;

