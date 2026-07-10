const mongoose = require("mongoose");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const Bookmark = require("../models/Bookmark");
const Follow = require("../models/Follow");
const Vote = require("../models/Vote");

async function getPersonalizedRecommendations(userId, limit = 10) {
  if (!userId || userId === "anonymous") {
    return getFallbackRecommendations(limit);
  }

  if (isMongoAvailable()) {
    // 1. Bookmarks
    const bookmarks = await Bookmark.find({ userId }).lean();
    const bookmarkedFaqIds = bookmarks.map((b) => b.questionId);

    // 2. Follows
    const follows = await Follow.find({ userId }).lean();
    const followedTags = follows
      .filter((f) => f.followableType === "tag")
      .map((f) => f.followableId);
    const followedFaqIds = follows
      .filter((f) => f.followableType === "question" && mongoose.Types.ObjectId.isValid(f.followableId))
      .map((f) => new mongoose.Types.ObjectId(f.followableId));

    // 3. Votes
    const votes = await Vote.find({ userId }).lean();
    const votedIds = votes.map((v) => v.targetId);

    // Interacted FAQs to determine category preferences
    const interactedFaqs = await FAQ.find({
      $or: [
        { _id: { $in: bookmarkedFaqIds } },
        { _id: { $in: followedFaqIds } }
      ]
    }).lean();

    const categories = new Set(interactedFaqs.map((f) => f.category));
    const tags = new Set([
      ...followedTags,
      ...interactedFaqs.flatMap((f) => f.tags || [])
    ]);

    // Exclude IDs
    const excludeIds = [
      ...bookmarkedFaqIds.map((id) => id.toString()),
      ...followedFaqIds.map((id) => id.toString()),
      ...votedIds.map((id) => id.toString())
    ];

    const matchConditions = [];
    if (categories.size > 0) {
      matchConditions.push({ category: { $in: Array.from(categories) } });
    }
    if (tags.size > 0) {
      matchConditions.push({ tags: { $in: Array.from(tags) } });
    }

    let recommended = [];
    if (matchConditions.length > 0) {
      recommended = await FAQ.find({
        _id: { $nin: excludeIds },
        $or: matchConditions
      })
        .sort({ searchBoost: -1, createdAt: -1 })
        .limit(limit)
        .lean();
    }

    if (recommended.length < limit) {
      const remainingLimit = limit - recommended.length;
      const recommendedIds = recommended.map((r) => r._id.toString());
      const allExclude = [...excludeIds, ...recommendedIds];

      const fallbacks = await FAQ.find({ _id: { $nin: allExclude } })
        .sort({ createdAt: -1 })
        .limit(remainingLimit)
        .lean();

      recommended = [...recommended, ...fallbacks];
    }

    return recommended.map((faq) => ({
      ...faq,
      id: faq._id.toString()
    }));
  } else {
    // SQLite personalization
    const db = getSQLiteDb();

    const bookmarks = await db.all("SELECT question_id FROM bookmarks WHERE user_id = ?", userId);
    const bookmarkedFaqIds = bookmarks.map((b) => b.question_id);

    const follows = await db.all("SELECT followable_type, followable_id FROM follows WHERE user_id = ?", userId);
    const followedTags = follows
      .filter((f) => f.followable_type === "tag")
      .map((f) => f.followable_id);
    const followedFaqIds = follows
      .filter((f) => f.followable_type === "question")
      .map((f) => f.followable_id);

    const votes = await db.all("SELECT target_id FROM votes WHERE user_id = ?", userId);
    const votedIds = votes.map((v) => v.target_id);

    const excludeIds = [...bookmarkedFaqIds, ...followedFaqIds, ...votedIds];

    let categoryList = [];
    let tagList = [...followedTags];

    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => "?").join(",");
      const interactedFaqs = await db.all(
        `SELECT category, tags FROM faqs WHERE id IN (${placeholders})`,
        ...excludeIds
      );
      interactedFaqs.forEach((faq) => {
        if (faq.category) categoryList.push(faq.category);
        if (faq.tags) {
          faq.tags.split(",").forEach((t) => tagList.push(t.trim()));
        }
      });
    }

    categoryList = Array.from(new Set(categoryList.filter(Boolean)));
    tagList = Array.from(new Set(tagList.filter(Boolean)));

    let recommended = [];

    if (categoryList.length > 0 || tagList.length > 0) {
      const conditions = [];
      const params = [];

      if (excludeIds.length > 0) {
        const placeholders = excludeIds.map(() => "?").join(",");
        conditions.push(`id NOT IN (${placeholders})`);
        params.push(...excludeIds);
      }

      const orConditions = [];
      if (categoryList.length > 0) {
        const catPlaceholders = categoryList.map(() => "?").join(",");
        orConditions.push(`category IN (${catPlaceholders})`);
        params.push(...categoryList);
      }

      tagList.forEach((tag) => {
        orConditions.push("tags LIKE ?");
        params.push(`%${tag}%`);
      });

      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(" OR ")})`);
      }

      let queryStr = "SELECT * FROM faqs";
      if (conditions.length > 0) {
        queryStr += " WHERE " + conditions.join(" AND ");
      }
      queryStr += " ORDER BY search_boost DESC, created_at DESC LIMIT ?";
      params.push(limit);

      recommended = await db.all(queryStr, ...params);
    }

    if (recommended.length < limit) {
      const remainingLimit = limit - recommended.length;
      const recommendedIds = recommended.map((r) => r.id);
      const allExclude = [...excludeIds, ...recommendedIds];

      const conditions = [];
      const params = [];

      if (allExclude.length > 0) {
        const placeholders = allExclude.map(() => "?").join(",");
        conditions.push(`id NOT IN (${placeholders})`);
        params.push(...allExclude);
      }

      let queryStr = "SELECT * FROM faqs";
      if (conditions.length > 0) {
        queryStr += " WHERE " + conditions.join(" AND ");
      }
      queryStr += " ORDER BY created_at DESC LIMIT ?";
      params.push(remainingLimit);

      const fallbacks = await db.all(queryStr, ...params);
      recommended = [...recommended, ...fallbacks];
    }

    return recommended.map((f) => ({
      ...f,
      id: String(f.id),
      tags: f.tags ? f.tags.split(",").filter(Boolean) : []
    }));
  }
}

async function getFallbackRecommendations(limit = 10) {
  if (isMongoAvailable()) {
    const faqs = await FAQ.find().sort({ searchBoost: -1, createdAt: -1 }).limit(limit).lean();
    return faqs.map((faq) => ({
      ...faq,
      id: faq._id.toString()
    }));
  } else {
    const db = getSQLiteDb();
    const faqs = await db.all("SELECT * FROM faqs ORDER BY search_boost DESC, created_at DESC LIMIT ?", limit);
    return faqs.map((f) => ({
      ...f,
      id: String(f.id),
      tags: f.tags ? f.tags.split(",").filter(Boolean) : []
    }));
  }
}

module.exports = {
  getPersonalizedRecommendations
};
