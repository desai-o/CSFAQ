const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const { trackEvent } = require("../services/eventService");

const { success, fail } = require("../utils/apiResponse");
const { searchLimiter } = require("../middleware/rateLimits");

const searchSchema = z.object({
  body: z.object({
    keyword: z.string().max(200).optional(),
    keywords: z.array(z.string().max(80)).optional(),
    category: z.string().max(100).optional(),
    limit: z.number().min(1).max(50).optional()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

// @route   POST api/search
// @desc    Search FAQs and queries
// @access  Public
router.post("/", searchLimiter, validate(searchSchema), async (req, res) => {
  try {
    const { keyword, keywords } = req.body;

    let searchTerms = [];

    if (Array.isArray(keywords)) {
      searchTerms = keywords;
    } else if (keyword) {
      searchTerms = keyword.split(/\s+/);
    }

    searchTerms = searchTerms
      .map((term) => String(term).trim().toLowerCase())
      .filter(Boolean);

    if (searchTerms.length === 0) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "At least one search keyword is required"
      });
    }

    const searchText = searchTerms.join(" ");
    const userId = req.user ? String(req.user.id || req.user._id) : "anonymous";

    await trackEvent({
      type: "search_performed",
      userId,
      targetType: "search",
      targetId: searchText,
      metadata: {
        terms: searchTerms
      }
    });

    let scoredFaqs = [];
    let scoredQueries = [];

    if (isMongoAvailable()) {
      const faqResults = await FAQ.find(
        {
          $text: {
            $search: searchText
          }
        },
        {
          score: {
            $meta: "textScore"
          }
        }
      );

      const queryResults = await UserQuery.find(
        {
          $text: {
            $search: searchText
          }
        },
        {
          score: {
            $meta: "textScore"
          }
        }
      );

      // Score tuning for Mongo results
      scoredFaqs = faqResults.map(faq => {
        let finalScore = faq.get("score") || 1.0;
        if (faq.searchBoost) finalScore += faq.searchBoost;
        const ageInMs = Date.now() - new Date(faq.updatedAt).getTime();
        const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
        if (ageInDays < 7) finalScore += 2.0;
        else if (ageInDays < 30) finalScore += 1.0;

        const tagOverlap = searchTerms.filter(term => faq.tags && faq.tags.includes(term)).length;
        finalScore += tagOverlap * 1.5;

        return { ...faq.toObject(), score: finalScore };
      }).sort((a, b) => b.score - a.score);

      scoredQueries = queryResults.map(q => {
        let finalScore = q.get("score") || 1.0;
        const ageInMs = Date.now() - new Date(q.updatedAt).getTime();
        const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
        if (ageInDays < 7) finalScore += 2.0;
        else if (ageInDays < 30) finalScore += 1.0;

        const tagOverlap = searchTerms.filter(term => q.tags && q.tags.includes(term)).length;
        finalScore += tagOverlap * 1.5;

        return { ...q.toObject(), score: finalScore };
      }).sort((a, b) => b.score - a.score);

      const totalResults = scoredFaqs.length + scoredQueries.length;
      try {
        const SearchAnalytic = require("../models/SearchAnalytic");
        await SearchAnalytic.create({ query: searchText, userId, resultsCount: totalResults });
      } catch (err) {
        console.error("Failed to save SearchAnalytic to Mongo:", err.message);
      }

      return success(res, {
        storage: "mongodb",
        data: {
          faqs: scoredFaqs,
          userQueries: scoredQueries
        },
        meta: { keyword: searchText }
      });
    }

    const db = getSQLiteDb();
    const likePattern = `%${searchText}%`;

    const faqResults = await db.all(
      `
      SELECT *
      FROM faqs
      WHERE LOWER(question) LIKE LOWER(?)
         OR LOWER(answer) LIKE LOWER(?)
         OR LOWER(keywords) LIKE LOWER(?)
      `,
      likePattern,
      likePattern,
      likePattern
    );

    const queryResults = await db.all(
      `
      SELECT *
      FROM user_queries
      WHERE LOWER(question) LIKE LOWER(?)
         OR LOWER(answer) LIKE LOWER(?)
      `,
      likePattern,
      likePattern
    );

    // Score tuning for SQLite results
    scoredFaqs = faqResults.map(faq => {
      let finalScore = 1.0;
      if (faq.search_boost) finalScore += faq.search_boost;
      const ageInMs = Date.now() - new Date(faq.updated_at).getTime();
      const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
      if (ageInDays < 7) finalScore += 2.0;
      else if (ageInDays < 30) finalScore += 1.0;

      const faqTags = faq.tags ? faq.tags.split(",").map(t => t.trim().toLowerCase()) : [];
      const tagOverlap = searchTerms.filter(term => faqTags.includes(term)).length;
      finalScore += tagOverlap * 1.5;

      return { ...faq, score: finalScore };
    }).sort((a, b) => b.score - a.score);

    scoredQueries = queryResults.map(q => {
      let finalScore = 1.0;
      const ageInMs = Date.now() - new Date(q.updated_at).getTime();
      const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
      if (ageInDays < 7) finalScore += 2.0;
      else if (ageInDays < 30) finalScore += 1.0;

      const qTags = q.tags ? q.tags.split(",").map(t => t.trim().toLowerCase()) : [];
      const tagOverlap = searchTerms.filter(term => qTags.includes(term)).length;
      finalScore += tagOverlap * 1.5;

      return { ...q, score: finalScore };
    }).sort((a, b) => b.score - a.score);

    const totalResults = scoredFaqs.length + scoredQueries.length;
    try {
      await db.run(
        `INSERT INTO search_analytics (query, user_id, results_count) VALUES (?, ?, ?)`,
        searchText,
        userId,
        totalResults
      );
    } catch (err) {
      console.error("Failed to save search analytic to SQLite:", err.message);
    }

    return success(res, {
      storage: "sqlite",
      data: {
        faqs: scoredFaqs,
        userQueries: scoredQueries
      },
      meta: { keyword: searchText }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "SEARCH_FAILED",
      message: "Search failed",
      details: error.message
    });
  }
});

module.exports = router;
