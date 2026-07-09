const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const Answer = require("../models/Answer");
const FAQRevision = require("../models/FAQRevision");
const QueryRevision = require("../models/QueryRevision");
const AnswerRevision = require("../models/AnswerRevision");
const { trackEvent } = require("./eventService");

/**
 * Saves a revision for a FAQ.
 */
async function saveFaqRevision(faqId, data) {
  const { question, answer, category, tags, userId, authorName } = data;

  if (isMongoAvailable()) {
    return await FAQRevision.create({
      faqId,
      question,
      answer,
      category,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(",").filter(Boolean) : []),
      userId: userId || "anonymous",
      authorName: authorName || "Anonymous"
    });
  }

  const db = getSQLiteDb();
  const tagsStr = Array.isArray(tags) ? tags.join(",") : (tags || "");

  const result = await db.run(
    `
    INSERT INTO faq_revisions (
      faq_id, question, answer, category, tags, user_id, author_name
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    String(faqId),
    question,
    answer,
    category || "General",
    tagsStr,
    userId || "anonymous",
    authorName || "Anonymous"
  );
  return { id: result.lastID, faqId, question, answer, category, tags: tagsStr, userId, authorName };
}

/**
 * Saves a revision for a UserQuery.
 */
async function saveQueryRevision(queryId, data) {
  const { question, description, answer, category, tags, status, userId, authorName } = data;

  if (isMongoAvailable()) {
    return await QueryRevision.create({
      queryId,
      question,
      description: description || "",
      answer: answer || "",
      category: category || "General",
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(",").filter(Boolean) : []),
      status: status || "pending",
      userId: userId || "anonymous",
      authorName: authorName || "Anonymous"
    });
  }

  const db = getSQLiteDb();
  const tagsStr = Array.isArray(tags) ? tags.join(",") : (tags || "");

  const result = await db.run(
    `
    INSERT INTO query_revisions (
      query_id, question, description, answer, category, tags, status, user_id, author_name
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    String(queryId),
    question,
    description || "",
    answer || "",
    category || "General",
    tagsStr,
    status || "pending",
    userId || "anonymous",
    authorName || "Anonymous"
  );
  return { id: result.lastID, queryId, question, description, answer, category, tags: tagsStr, status, userId, authorName };
}

/**
 * Saves a revision for an Answer.
 */
async function saveAnswerRevision(answerId, data) {
  const { content, userId, authorName } = data;

  if (isMongoAvailable()) {
    return await AnswerRevision.create({
      answerId,
      content,
      userId: userId || "anonymous",
      authorName: authorName || "Community Member"
    });
  }

  const db = getSQLiteDb();
  const result = await db.run(
    `
    INSERT INTO answer_revisions (
      answer_id, content, user_id, author_name
    )
    VALUES (?, ?, ?, ?)
    `,
    String(answerId),
    content,
    userId || "anonymous",
    authorName || "Community Member"
  );
  return { id: result.lastID, answerId, content, userId, authorName };
}

/**
 * Gets revision history for a FAQ.
 */
async function getFaqRevisions(faqId) {
  if (isMongoAvailable()) {
    return await FAQRevision.find({ faqId }).sort({ createdAt: -1 });
  }

  const db = getSQLiteDb();
  const rows = await db.all(
    `
    SELECT *
    FROM faq_revisions
    WHERE faq_id = ?
    ORDER BY created_at DESC
    `,
    String(faqId)
  );

  return rows.map(r => ({
    _id: String(r.id),
    faqId: r.faq_id,
    question: r.question,
    answer: r.answer,
    category: r.category,
    tags: r.tags ? r.tags.split(",") : [],
    userId: r.user_id,
    authorName: r.author_name,
    createdAt: r.created_at
  }));
}

/**
 * Gets revision history for an Answer.
 */
async function getAnswerRevisions(answerId) {
  if (isMongoAvailable()) {
    return await AnswerRevision.find({ answerId }).sort({ createdAt: -1 });
  }

  const db = getSQLiteDb();
  const rows = await db.all(
    `
    SELECT *
    FROM answer_revisions
    WHERE answer_id = ?
    ORDER BY created_at DESC
    `,
    String(answerId)
  );

  return rows.map(r => ({
    _id: String(r.id),
    answerId: r.answer_id,
    content: r.content,
    userId: r.user_id,
    authorName: r.author_name,
    createdAt: r.created_at
  }));
}

/**
 * Performs FAQ rollback.
 */
async function rollbackFaq(faqId, revisionId, actor) {
  let revision;

  if (isMongoAvailable()) {
    revision = await FAQRevision.findById(revisionId);
    if (!revision || String(revision.faqId) !== String(faqId)) {
      throw new Error("Revision not found");
    }

    const currentFaq = await FAQ.findById(faqId);
    if (!currentFaq) {
      throw new Error("FAQ not found");
    }

    // Save current state as revision
    await saveFaqRevision(faqId, {
      question: currentFaq.question,
      answer: currentFaq.answer,
      category: currentFaq.category,
      tags: currentFaq.tags,
      userId: actor.id,
      authorName: actor.name
    });

    // Apply revision values
    currentFaq.question = revision.question;
    currentFaq.answer = revision.answer;
    currentFaq.category = revision.category;
    currentFaq.tags = revision.tags;
    await currentFaq.save();

    await trackEvent({
      type: "faq_rollback",
      userId: actor.id,
      targetType: "faq",
      targetId: String(faqId),
      metadata: { revisionId: String(revisionId) }
    });

    return currentFaq;
  }

  const db = getSQLiteDb();
  revision = await db.get(
    "SELECT * FROM faq_revisions WHERE id = ? AND faq_id = ?",
    revisionId,
    String(faqId)
  );

  if (!revision) {
    throw new Error("Revision not found");
  }

  const currentFaq = await db.get("SELECT * FROM faqs WHERE id = ?", faqId);
  if (!currentFaq) {
    throw new Error("FAQ not found");
  }

  // Save current state as revision
  await saveFaqRevision(faqId, {
    question: currentFaq.question,
    answer: currentFaq.answer,
    category: currentFaq.category,
    tags: currentFaq.tags,
    userId: actor.id,
    authorName: actor.name
  });

  // Apply revision values
  await db.run(
    `
    UPDATE faqs
    SET question = ?,
        answer = ?,
        category = ?,
        tags = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    revision.question,
    revision.answer,
    revision.category,
    revision.tags,
    faqId
  );

  await trackEvent({
    type: "faq_rollback",
    userId: actor.id,
    targetType: "faq",
    targetId: String(faqId),
    metadata: { revisionId: String(revisionId) }
  });

  return {
    id: faqId,
    question: revision.question,
    answer: revision.answer,
    category: revision.category,
    tags: revision.tags
  };
}

/**
 * Performs Answer rollback.
 */
async function rollbackAnswer(answerId, revisionId, actor) {
  let revision;

  if (isMongoAvailable()) {
    revision = await AnswerRevision.findById(revisionId);
    if (!revision || String(revision.answerId) !== String(answerId)) {
      throw new Error("Revision not found");
    }

    const currentAnswer = await Answer.findById(answerId);
    if (!currentAnswer) {
      throw new Error("Answer not found");
    }

    // Save current state as revision
    await saveAnswerRevision(answerId, {
      content: currentAnswer.content,
      userId: actor.id,
      authorName: actor.name
    });

    // Apply revision values
    currentAnswer.content = revision.content;
    await currentAnswer.save();

    await trackEvent({
      type: "answer_rollback",
      userId: actor.id,
      targetType: "answer",
      targetId: String(answerId),
      metadata: { revisionId: String(revisionId) }
    });

    return currentAnswer;
  }

  const db = getSQLiteDb();
  revision = await db.get(
    "SELECT * FROM answer_revisions WHERE id = ? AND answer_id = ?",
    revisionId,
    String(answerId)
  );

  if (!revision) {
    throw new Error("Revision not found");
  }

  const currentAnswer = await db.get("SELECT * FROM answers WHERE id = ?", answerId);
  if (!currentAnswer) {
    throw new Error("Answer not found");
  }

  // Save current state as revision
  await saveAnswerRevision(answerId, {
    content: currentAnswer.content,
    userId: actor.id,
    authorName: actor.name
  });

  // Apply revision values
  await db.run(
    `
    UPDATE answers
    SET content = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    revision.content,
    answerId
  );

  await trackEvent({
    type: "answer_rollback",
    userId: actor.id,
    targetType: "answer",
    targetId: String(answerId),
    metadata: { revisionId: String(revisionId) }
  });

  return {
    id: answerId,
    content: revision.content
  };
}

/**
 * Gets revision history for a UserQuery.
 */
async function getQueryRevisions(queryId) {
  if (isMongoAvailable()) {
    return await QueryRevision.find({ queryId }).sort({ createdAt: -1 });
  }

  const db = getSQLiteDb();
  const rows = await db.all(
    `
    SELECT *
    FROM query_revisions
    WHERE query_id = ?
    ORDER BY created_at DESC
    `,
    String(queryId)
  );

  return rows.map(r => ({
    _id: String(r.id),
    queryId: r.query_id,
    question: r.question,
    description: r.description,
    answer: r.answer,
    category: r.category,
    tags: r.tags ? r.tags.split(",") : [],
    status: r.status,
    userId: r.user_id,
    authorName: r.author_name,
    createdAt: r.created_at
  }));
}

module.exports = {
  saveFaqRevision,
  saveQueryRevision,
  saveAnswerRevision,
  getFaqRevisions,
  getQueryRevisions,
  getAnswerRevisions,
  rollbackFaq,
  rollbackAnswer
};

