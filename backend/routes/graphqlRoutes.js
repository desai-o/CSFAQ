const express = require("express");
const router = express.Router();
const { graphql, buildSchema } = require("graphql");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const Answer = require("../models/Answer");
const { optionalAuth } = require("../middleware/auth");

// 1. GraphQL schema definition
const schema = buildSchema(`
  type FAQ {
    id: ID!
    question: String!
    answer: String!
    category: String!
    tags: [String]!
    moderationStatus: String!
    createdAt: String!
  }

  type UserQuery {
    id: ID!
    question: String!
    description: String
    status: String!
    category: String!
    tags: [String]!
    moderationStatus: String!
    createdAt: String!
  }

  type Answer {
    id: ID!
    questionId: String
    queryId: String
    content: String!
    authorName: String!
    userId: String!
    moderationStatus: String!
    createdAt: String!
  }

  type Query {
    faqs(limit: Int, offset: Int): [FAQ]!
    faq(id: ID!): FAQ
    queries(limit: Int, offset: Int): [UserQuery]!
    query(id: ID!): UserQuery
    answers(questionId: ID, queryId: ID): [Answer]!
  }
`);

// Helper to check moderation status
function isApproved(status) {
  return status !== "needs_review" && status !== "rejected";
}

// 2. Resolver functions
const rootValue = {
  faqs: async ({ limit = 10, offset = 0 }) => {
    if (isMongoAvailable()) {
      const results = await FAQ.find({ moderationStatus: { $nin: ["needs_review", "rejected"] } })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
      return results.map(r => ({
        id: String(r._id),
        question: r.question,
        answer: r.answer,
        category: r.category,
        tags: r.tags || [],
        moderationStatus: r.moderationStatus,
        createdAt: r.createdAt ? r.createdAt.toISOString() : ""
      }));
    }
    const db = getSQLiteDb();
    const rows = await db.all(
      "SELECT * FROM faqs WHERE moderation_status NOT IN ('needs_review', 'rejected') ORDER BY created_at DESC LIMIT ? OFFSET ?",
      limit,
      offset
    );
    return rows.map(r => ({
      id: String(r.id),
      question: r.question,
      answer: r.answer,
      category: r.category,
      tags: r.tags ? r.tags.split(",") : [],
      moderationStatus: r.moderation_status,
      createdAt: r.created_at
    }));
  },

  faq: async ({ id }) => {
    if (isMongoAvailable()) {
      const r = await FAQ.findById(id);
      if (!r || !isApproved(r.moderationStatus)) return null;
      return {
        id: String(r._id),
        question: r.question,
        answer: r.answer,
        category: r.category,
        tags: r.tags || [],
        moderationStatus: r.moderationStatus,
        createdAt: r.createdAt ? r.createdAt.toISOString() : ""
      };
    }
    const db = getSQLiteDb();
    const r = await db.get("SELECT * FROM faqs WHERE id = ? OR mongo_id = ?", id, id);
    if (!r || !isApproved(r.moderation_status)) return null;
    return {
      id: String(r.id),
      question: r.question,
      answer: r.answer,
      category: r.category,
      tags: r.tags ? r.tags.split(",") : [],
      moderationStatus: r.moderation_status,
      createdAt: r.created_at
    };
  },

  queries: async ({ limit = 10, offset = 0 }) => {
    if (isMongoAvailable()) {
      const results = await UserQuery.find({ moderationStatus: { $nin: ["needs_review", "rejected"] } })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
      return results.map(r => ({
        id: String(r._id),
        question: r.question,
        description: r.description,
        status: r.status,
        category: r.category,
        tags: r.tags || [],
        moderationStatus: r.moderationStatus,
        createdAt: r.createdAt ? r.createdAt.toISOString() : ""
      }));
    }
    const db = getSQLiteDb();
    const rows = await db.all(
      "SELECT * FROM user_queries WHERE moderation_status NOT IN ('needs_review', 'rejected') ORDER BY created_at DESC LIMIT ? OFFSET ?",
      limit,
      offset
    );
    return rows.map(r => ({
      id: String(r.id),
      question: r.question,
      description: r.description,
      status: r.status,
      category: r.category,
      tags: r.tags ? r.tags.split(",") : [],
      moderationStatus: r.moderation_status,
      createdAt: r.created_at
    }));
  },

  query: async ({ id }) => {
    if (isMongoAvailable()) {
      const r = await UserQuery.findById(id);
      if (!r || !isApproved(r.moderationStatus)) return null;
      return {
        id: String(r._id),
        question: r.question,
        description: r.description,
        status: r.status,
        category: r.category,
        tags: r.tags || [],
        moderationStatus: r.moderationStatus,
        createdAt: r.createdAt ? r.createdAt.toISOString() : ""
      };
    }
    const db = getSQLiteDb();
    const r = await db.get("SELECT * FROM user_queries WHERE id = ? OR mongo_id = ?", id, id);
    if (!r || !isApproved(r.moderation_status)) return null;
    return {
      id: String(r.id),
      question: r.question,
      description: r.description,
      status: r.status,
      category: r.category,
      tags: r.tags ? r.tags.split(",") : [],
      moderationStatus: r.moderation_status,
      createdAt: r.created_at
    };
  },

  answers: async ({ questionId, queryId }) => {
    if (!questionId && !queryId) return [];

    if (isMongoAvailable()) {
      const filter = { moderationStatus: { $nin: ["needs_review", "rejected"] } };
      if (questionId) filter.questionId = questionId;
      if (queryId) filter.queryId = queryId;

      const results = await Answer.find(filter).sort({ createdAt: -1 });
      return results.map(r => ({
        id: String(r._id),
        questionId: String(r.questionId || ""),
        queryId: String(r.queryId || ""),
        content: r.content,
        authorName: r.authorName,
        userId: r.userId,
        moderationStatus: r.moderationStatus,
        createdAt: r.createdAt ? r.createdAt.toISOString() : ""
      }));
    }

    const db = getSQLiteDb();
    let rows = [];
    if (questionId) {
      rows = await db.all(
        "SELECT * FROM answers WHERE question_id = ? AND moderation_status NOT IN ('needs_review', 'rejected') ORDER BY created_at DESC",
        questionId
      );
    } else {
      rows = await db.all(
        "SELECT * FROM answers WHERE query_id = ? AND moderation_status NOT IN ('needs_review', 'rejected') ORDER BY created_at DESC",
        queryId
      );
    }

    return rows.map(r => ({
      id: String(r.id),
      questionId: r.question_id,
      queryId: r.query_id,
      content: r.content,
      authorName: r.author_name,
      userId: r.user_id,
      moderationStatus: r.moderation_status,
      createdAt: r.created_at
    }));
  }
};

// 3. GraphQL POST Endpoint
router.post("/", optionalAuth, async (req, res) => {
  const { query, variables } = req.body;
  if (!query) {
    return res.status(400).json({ error: "GraphQL query is required in post body" });
  }

  try {
    const result = await graphql({
      schema,
      source: query,
      rootValue,
      variableValues: variables
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "GraphQL execution error", details: error.message });
  }
});

module.exports = router;
