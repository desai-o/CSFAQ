const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const LearningPath = require("../models/LearningPath");
const FAQ = require("../models/FAQ");
const { success, fail } = require("../utils/apiResponse");
const { writeLimiter } = require("../middleware/rateLimits");

const createPathSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(1000).optional(),
    category: z.string().trim().min(1).max(100),
    items: z.array(
      z.object({
        faqId: z.string().min(1),
        position: z.number().int().min(0)
      })
    ).min(1)
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

// List all learning paths
router.get("/", async (req, res) => {
  try {
    if (isMongoAvailable()) {
      const paths = await LearningPath.find().sort({ createdAt: -1 }).lean();
      return success(res, { storage: "mongodb", data: paths });
    }

    const db = getSQLiteDb();
    const paths = await db.all("SELECT * FROM learning_paths ORDER BY created_at DESC");
    return success(res, { storage: "sqlite", data: paths });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "FETCH_PATHS_FAILED", message: error.message });
  }
});

// Get a learning path detail with populated FAQs
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (isMongoAvailable()) {
      const path = await LearningPath.findById(id).lean();
      if (!path) {
        return fail(res, { statusCode: 404, code: "PATH_NOT_FOUND", message: "Learning path not found" });
      }

      // Populate FAQs
      const faqIds = path.items.map((item) => item.faqId);
      const faqs = await FAQ.find({ _id: { $in: faqIds } }).lean();
      
      const faqMap = {};
      faqs.forEach((faq) => {
        faqMap[faq._id.toString()] = faq;
      });

      const populatedItems = path.items
        .map((item) => ({
          position: item.position,
          faq: faqMap[item.faqId.toString()] || null
        }))
        .filter((item) => item.faq !== null);

      return success(res, {
        storage: "mongodb",
        data: {
          ...path,
          items: populatedItems
        }
      });
    }

    const db = getSQLiteDb();
    const path = await db.get("SELECT * FROM learning_paths WHERE id = ?", id);
    if (!path) {
      return fail(res, { statusCode: 404, code: "PATH_NOT_FOUND", message: "Learning path not found" });
    }

    const items = await db.all("SELECT * FROM learning_path_items WHERE learning_path_id = ? ORDER BY position", id);
    const faqIds = items.map((i) => i.faq_id);

    let populatedItems = [];
    if (faqIds.length > 0) {
      const placeholders = faqIds.map(() => "?").join(",");
      const faqs = await db.all(
        `SELECT * FROM faqs WHERE id IN (${placeholders}) OR mongo_id IN (${placeholders})`,
        ...faqIds,
        ...faqIds
      );

      const faqMap = {};
      faqs.forEach((faq) => {
        faqMap[String(faq.id)] = faq;
        if (faq.mongo_id) faqMap[faq.mongo_id] = faq;
      });

      populatedItems = items
        .map((item) => ({
          position: item.position,
          faq: faqMap[item.faq_id] ? {
            ...faqMap[item.faq_id],
            id: String(faqMap[item.faq_id].id),
            tags: faqMap[item.faq_id].tags ? faqMap[item.faq_id].tags.split(",") : []
          } : null
        }))
        .filter((item) => item.faq !== null);
    }

    return success(res, {
      storage: "sqlite",
      data: {
        ...path,
        items: populatedItems
      }
    });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "FETCH_PATH_FAILED", message: error.message });
  }
});

// Create learning path
router.post("/", requireAuth, writeLimiter, validate(createPathSchema), async (req, res) => {
  try {
    const { title, description, category, items } = req.body;
    const userId = req.user.id;

    if (isMongoAvailable()) {
      const path = await LearningPath.create({
        title,
        description,
        category,
        createdBy: userId,
        items
      });

      // Sync to SQLite fallback
      try {
        const db = getSQLiteDb();
        await db.run(
          `INSERT INTO learning_paths (id, title, description, category, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          path._id.toString(),
          title,
          description || "",
          category,
          userId
        );

        for (const item of items) {
          await db.run(
            `INSERT INTO learning_path_items (learning_path_id, faq_id, position)
             VALUES (?, ?, ?)`,
            path._id.toString(),
            item.faqId,
            item.position
          );
        }
      } catch (err) {
        console.error("SQLite learning path sync failed:", err.message);
      }

      return success(res, { statusCode: 201, storage: "mongodb", data: path });
    }

    const db = getSQLiteDb();
    const pathId = "lp_" + Math.random().toString(36).substring(2, 15);
    await db.run(
      `INSERT INTO learning_paths (id, title, description, category, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      pathId,
      title,
      description || "",
      category,
      userId
    );

    for (const item of items) {
      await db.run(
        `INSERT INTO learning_path_items (learning_path_id, faq_id, position)
         VALUES (?, ?, ?)`,
        pathId,
        item.faqId,
        item.position
      );
    }

    return success(res, {
      statusCode: 201,
      storage: "sqlite",
      data: {
        id: pathId,
        title,
        description,
        category,
        createdBy: userId,
        items
      }
    });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "CREATE_PATH_FAILED", message: error.message });
  }
});

module.exports = router;
