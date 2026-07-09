const { GoogleGenAI } = require("@google/genai");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const DuplicateLink = require("../models/DuplicateLink");

let ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

function calculateJaccardSimilarity(str1, str2) {
  const words = (str) => new Set(str.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));
  const set1 = words(str1);
  const set2 = words(str2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

async function checkDuplicates(questionText, options = {}) {
  const { persist = true } = options;

  if (!questionText || typeof questionText !== "string") {
    return [];
  }

  // 1. Gather FAQ and UserQuery candidates from SQLite fallback
  const db = getSQLiteDb();
  let candidates = [];

  try {
    const faqs = await db.all("SELECT id as sqlite_id, mongo_id, question, 'faq' as type FROM faqs");
    const queries = await db.all("SELECT id as sqlite_id, mongo_id, question, 'query' as type FROM user_queries");
    candidates = [...faqs, ...queries];
  } catch (err) {
    console.error("Failed to fetch candidates from SQLite:", err.message);
  }

  // 2. Score candidates using Jaccard word overlap
  const scored = candidates.map(c => {
    const sim = calculateJaccardSimilarity(questionText, c.question);
    return { ...c, jaccard: sim };
  }).filter(c => c.jaccard > 0.15)
    .sort((a, b) => b.jaccard - a.jaccard)
    .slice(0, 3);

  if (scored.length === 0) {
    return [];
  }

  const finalCandidates = [];

  // 3. Consult Gemini to refine scoring if API key present
  if (ai) {
    try {
      const candidatesPrompt = scored.map((c, i) => `${i + 1}. [Type: ${c.type}] "${c.question}"`).join("\n");
      const prompt = `
You are an expert duplicate Q&A detector.
The user is asking: "${questionText}"

Here are potential duplicates:
${candidatesPrompt}

Verify if any of these are duplicates. Respond with a JSON array matching the schema:
[
  {
    "index": 1,
    "similarity": number,
    "explanation": "short explanation of why it is/is not a duplicate"
  }
]
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(response.text.trim().replace(/```json/g, "").replace(/```/g, "").trim());
      
      for (const res of parsed) {
        const item = scored[res.index - 1];
        if (item) {
          finalCandidates.push({
            id: item.mongo_id || String(item.sqlite_id),
            type: item.type,
            question: item.question,
            similarity: res.similarity,
            explanation: res.explanation
          });
        }
      }
    } catch (err) {
      console.warn("Gemini duplicate check failed, using Jaccard fallback:", err.message);
    }
  }

  // If Gemini failed or was bypassed, populate with Jaccard scores
  if (finalCandidates.length === 0) {
    for (const item of scored) {
      finalCandidates.push({
        id: item.mongo_id || String(item.sqlite_id),
        type: item.type,
        question: item.question,
        similarity: Math.round(item.jaccard * 100) / 100,
        explanation: `Matches key vocabulary terms with ${Math.round(item.jaccard * 100)}% vocabulary overlap.`
      });
    }
  }

  if (persist) {
    // 4. Save duplicate candidates to Database
    for (const cand of finalCandidates) {
      let savedMongoLink = null;
      if (isMongoAvailable()) {
        try {
          const link = await DuplicateLink.findOneAndUpdate(
            { sourceId: questionText, targetId: cand.id },
            { similarity: cand.similarity, explanation: cand.explanation, status: cand.similarity > 0.7 ? "confirmed" : "pending" },
            { upsert: true, new: true }
          );
          savedMongoLink = link;
        } catch (err) {
          console.error("Failed to save DuplicateLink to Mongo:", err.message);
        }
      }

      try {
        const sqliteMongoId = savedMongoLink ? String(savedMongoLink._id) : null;
        await db.run(
          `
          INSERT INTO duplicate_links (mongo_id, source_id, target_id, similarity, explanation, status)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET similarity = excluded.similarity, explanation = excluded.explanation
          `,
          sqliteMongoId,
          questionText,
          cand.id,
          cand.similarity,
          cand.explanation,
          cand.similarity > 0.7 ? "confirmed" : "pending"
        );
      } catch (err) {
        console.error("Failed to save DuplicateLink to SQLite:", err.message);
      }
    }
  }

  return finalCandidates.sort((a, b) => b.similarity - a.similarity);
}

module.exports = {
  checkDuplicates
};
