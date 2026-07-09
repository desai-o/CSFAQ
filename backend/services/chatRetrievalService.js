const { GoogleGenAI } = require("@google/genai");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const ChatLog = require("../models/ChatLog");

let ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

async function searchFAQsForContext(queryText) {
  const db = getSQLiteDb();
  let faqs = [];
  try {
    // Perform simple keyword search on faqs
    const keywords = queryText.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return [];

    const likes = keywords.map(() => "question LIKE ? OR answer LIKE ?").join(" OR ");
    const params = [];
    keywords.forEach(kw => {
      params.push(`%${kw}%`);
      params.push(`%${kw}%`);
    });

    faqs = await db.all(
      `
      SELECT id, mongo_id, question, answer
      FROM faqs
      WHERE ${likes}
      LIMIT 3
      `,
      ...params
    );
  } catch (err) {
    console.error("Failed to query SQLite for chat context:", err.message);
  }
  return faqs;
}

async function runChatAssistant({ message, history = [], userId = "anonymous" }) {
  // 1. Retrieve FAQs for context
  const matchedFaqs = await searchFAQsForContext(message);

  const contextStr = matchedFaqs.map((faq, i) => {
    const id = faq.mongo_id || faq.id;
    return `[FAQ ID: ${id}]\nQ: ${faq.question}\nA: ${faq.answer}`;
  }).join("\n\n");

  let botResponse = "";
  const citations = matchedFaqs.map(faq => String(faq.mongo_id || faq.id));

  // 2. Query Gemini if available
  if (ai) {
    try {
      const formattedHistory = history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }]
      }));

      const contextPrompt = `
You are the CrowdFAQ RAG AI Assistant. Answer the user's message using the following matching FAQ context where relevant.
Include source citations in brackets (e.g. "[FAQ ID: <id>]") if you use information from the FAQ context.
If no context is provided or it doesn't answer the question, answer to the best of your ability, indicating you didn't find specific matching FAQs.

FAQ Context:
${contextStr || "No matching FAQs found in database."}

Current User Message: ${message}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          ...formattedHistory,
          { role: "user", parts: [{ text: contextPrompt }] }
        ]
      });

      botResponse = response.text;
    } catch (err) {
      console.error("Gemini chat call failed, using fallback:", err.message);
    }
  }

  // 3. Fallback answer if Gemini is offline
  if (!botResponse) {
    if (matchedFaqs.length > 0) {
      botResponse = `Based on FAQ topic: "${matchedFaqs[0].question}", the answer is: ${matchedFaqs[0].answer} [FAQ ID: ${matchedFaqs[0].mongo_id || matchedFaqs[0].id}]`;
    } else {
      botResponse = "I'm sorry, I am currently offline and couldn't find any direct matches in the FAQ database to answer your question.";
    }
  }

  // 4. Save Chat Log
  let savedMongoLog = null;
  if (isMongoAvailable()) {
    try {
      const log = new ChatLog({
        userId,
        message,
        response: botResponse,
        retrievedFaqs: citations
      });
      savedMongoLog = await log.save();
    } catch (err) {
      console.error("Failed to save ChatLog to Mongo:", err.message);
    }
  }

  try {
    const db = getSQLiteDb();
    const mongoIdStr = savedMongoLog ? String(savedMongoLog._id) : null;
    await db.run(
      `
      INSERT INTO chat_logs (mongo_id, user_id, message, response, retrieved_faqs)
      VALUES (?, ?, ?, ?, ?)
      `,
      mongoIdStr,
      userId,
      message,
      botResponse,
      JSON.stringify(citations)
    );
  } catch (err) {
    console.error("Failed to save ChatLog to SQLite:", err.message);
  }

  return {
    response: botResponse,
    citations
  };
}

module.exports = {
  runChatAssistant
};
