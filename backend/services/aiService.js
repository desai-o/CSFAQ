const { GoogleGenAI } = require("@google/genai");

let ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

async function generateSummary(question, answers) {
  if (!ai) {
    return `Summary unavailable: Gemini API key not configured.`;
  }

  const prompt = `
Summarize this FAQ discussion.

Question:
${question}

Answers:
${answers.join("\n")}

Return:
- 3 bullet points
- Maximum 100 words
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text;
}

function buildFallbackExport(faqs) {
  const grouped = faqs.reduce((acc, faq) => {
    const category = faq.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push({
      question: faq.question,
      answer: faq.answer,
      category,
      tags: faq.tags || []
    });
    return acc;
  }, {});

  return {
    title: "CrowdFAQ Knowledge Export",
    summary: `This export contains ${faqs.length} FAQs grouped by category.`,
    sections: Object.entries(grouped).map(([heading, sectionFaqs]) => ({
      heading,
      faqs: sectionFaqs
    }))
  };
}

async function formatFaqsForExport(faqs, options = {}) {
  const formattedFaqs = faqs.map((faq) => ({
    question: faq.question || "",
    answer: faq.answer || "",
    category: faq.category || "General",
    tags: Array.isArray(faq.tags) ? faq.tags : []
  }));

  if (!ai || process.env.NODE_ENV === "test") {
    return buildFallbackExport(formattedFaqs);
  }

  const prompt = `
You are an expert knowledge export assistant.
Reorganize the following FAQ data for a printable export.

Return valid JSON only. Do not include any markdown, code fences, or explanatory text.
Do not invent any new information.
Do not modify or rewrite any FAQ answer text.
Do not remove warnings or instructions present in the answers.
You may group FAQs by category, generate section headings, provide a short summary, and generate a table of contents.

Input JSON array:
${JSON.stringify(formattedFaqs, null, 2)}

Output schema:
{
  "title": "string",
  "summary": "string",
  "sections": [
    {
      "heading": "string",
      "faqs": [
        {
          "question": "string",
          "answer": "string",
          "category": "string",
          "tags": ["string"]
        }
      ]
    }
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const clean = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (!parsed || !Array.isArray(parsed.sections)) {
      throw new Error("AI export returned invalid structure");
    }

    return parsed;
  } catch (err) {
    console.warn("Gemini AI export formatting failed, falling back to category grouping:", err.message);
    return buildFallbackExport(formattedFaqs);
  }
}

module.exports = {
  generateSummary,
  formatFaqsForExport
};