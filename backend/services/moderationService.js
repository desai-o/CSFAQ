const { GoogleGenAI } = require("@google/genai");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const ModerationRecord = require("../models/ModerationRecord");

let ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

// Local fallback dictionary for offline/test resilience
const SPAM_KEYWORDS = ["spamlink", "viagra", "buy-now", "free-money", "cheap-crypto"];

async function runModerationCheck(text) {
  if (!text || typeof text !== "string") {
    return { flagged: false, confidence: 1.0, categories: [], reason: "Empty input" };
  }

  // 1. Try Gemini AI if API key is present
  if (ai) {
    try {
      const prompt = `
Assess the following user submission for moderation issues (e.g., spam, toxic content, hate speech, severe profanity, or completely off-topic advertising).
You MUST respond with a valid JSON object matching the schema:
{
  "flagged": boolean,
  "confidence": number (between 0.0 and 1.0),
  "categories": ["spam" | "toxic" | "hate" | "off-topic"],
  "reason": "short explanation of why it was flagged or why it is clear"
}

Text to assess:
"${text}"
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const responseText = response.text.trim();
      // Parse JSON from text
      const cleanJsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJsonStr);

      return {
        flagged: !!parsed.flagged,
        confidence: Number(parsed.confidence) || 0.9,
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        reason: parsed.reason || ""
      };
    } catch (err) {
      console.warn("Gemini moderation call failed, using fallback:", err.message);
    }
  }

  // 2. Fallback: scan local keywords
  const lower = text.toLowerCase();
  const foundSpam = SPAM_KEYWORDS.filter(word => lower.includes(word));
  if (foundSpam.length > 0) {
    return {
      flagged: true,
      confidence: 0.85,
      categories: ["spam"],
      reason: `Flagged by keyword match: ${foundSpam.join(", ")}`
    };
  }

  return {
    flagged: false,
    confidence: 0.95,
    categories: [],
    reason: "No matches in keyword block list"
  };
}

async function createModerationRecord({ targetType, targetId, text }) {
  const result = await runModerationCheck(text);

  const status = result.flagged ? "needs_review" : "auto_clear";

  let savedRecord = null;

  if (isMongoAvailable()) {
    try {
      const record = new ModerationRecord({
        targetType,
        targetId,
        flagged: result.flagged,
        confidence: result.confidence,
        categories: result.categories,
        reason: result.reason,
        status,
        auditTrail: [{ action: "ai_flag", actor: "system", note: `AI moderation check: status is ${status}` }]
      });
      savedRecord = await record.save();
    } catch (err) {
      console.error("Failed to save Mongo moderation record:", err.message);
    }
  }

  // Save to SQLite
  try {
    const db = getSQLiteDb();
    const mongoIdStr = savedRecord ? String(savedRecord._id) : null;
    const categoriesJson = JSON.stringify(result.categories);
    const auditTrailJson = JSON.stringify([{ action: "ai_flag", actor: "system", timestamp: new Date().toISOString(), note: `AI moderation check: status is ${status}` }]);

    await db.run(
      `
      INSERT INTO moderation_records (
        mongo_id, target_type, target_id, flagged, confidence, categories, reason, status, audit_trail
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      mongoIdStr,
      targetType,
      targetId,
      result.flagged ? 1 : 0,
      result.confidence,
      categoriesJson,
      result.reason,
      status,
      auditTrailJson
    );
  } catch (err) {
    console.error("Failed to save SQLite moderation record:", err.message);
  }

  return result;
}

module.exports = {
  runModerationCheck,
  createModerationRecord
};
