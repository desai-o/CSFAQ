const FAQ = require("../models/FAQ");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");

async function runRelevanceDecayJob() {
  const now = new Date();
  
  if (isMongoAvailable()) {
    const faqs = await FAQ.find();
    for (const faq of faqs) {
      const lastReviewed = faq.lastReviewedAt || faq.createdAt || now;
      const daysSinceReview = Math.max(0, (now - new Date(lastReviewed)) / (1000 * 60 * 60 * 24));
      
      // decay formula: staleScore = daysSinceReview * 0.1
      const staleScore = daysSinceReview * 0.1;
      faq.staleScore = staleScore;
      
      // stale threshold = 5 (corresponds to 50 days without review)
      if (staleScore > 5 && !faq.needsUpdate) {
        faq.needsUpdate = true;
        faq.updateReason = `Relevance decayed over time (${Math.round(daysSinceReview)} days since last review)`;
      }
      await faq.save();
    }
  }

  // SQLite parity
  const db = getSQLiteDb();
  const sqliteFaqs = await db.all("SELECT * FROM faqs");
  for (const faq of sqliteFaqs) {
    const lastReviewedStr = faq.last_reviewed_at || faq.created_at || now.toISOString();
    const lastReviewed = new Date(lastReviewedStr);
    const daysSinceReview = Math.max(0, (now - lastReviewed) / (1000 * 60 * 60 * 24));
    const staleScore = daysSinceReview * 0.1;

    let needsUpdate = faq.needs_update || 0;
    let updateReason = faq.update_reason || "";
    if (staleScore > 5 && needsUpdate === 0) {
      needsUpdate = 1;
      updateReason = `Relevance decayed over time (${Math.round(daysSinceReview)} days since last review)`;
    }

    await db.run(
      `
      UPDATE faqs
      SET stale_score = ?,
          needs_update = ?,
          update_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      staleScore,
      needsUpdate,
      updateReason,
      faq.id
    );
  }
}

module.exports = {
  runRelevanceDecayJob
};
