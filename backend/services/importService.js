const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const { formatFaqsForExport } = require("./aiService");
const { checkDuplicates } = require("./duplicateDetectionService");

/**
 * Normalize an "upvotes"-like value to a non-negative integer.
 * Accepts numbers or numeric strings; falls back to 0 when invalid.
 */
function normalizeUpvotes(value) {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : parseInt(String(value).trim(), 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.floor(n);
}

function splitCSVRow(line) {
  const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
  return matches.map(m => m.replace(/^"|"$/g, "").trim());
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const questionIdx = headers.indexOf("question");
  const answerIdx = headers.indexOf("answer");
  const categoryIdx = headers.indexOf("category");
  const tagsIdx = headers.indexOf("tags");
  const upvotesIdx = headers.indexOf("upvotes");

  if (questionIdx === -1 || answerIdx === -1) {
    throw new Error("CSV must contain 'Question' and 'Answer' columns in the header row");
  }

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVRow(lines[i]);
    const question = row[questionIdx];
    const answer = row[answerIdx];
    if (!question && !answer) continue;

    results.push({
      rowNum: i + 1,
      question: question || "",
      answer: answer || "",
      category: categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx] : "General",
      tags: tagsIdx !== -1 && row[tagsIdx] ? row[tagsIdx].split(";").map(t => t.trim()).filter(Boolean) : [],
      upvotes: upvotesIdx !== -1 ? normalizeUpvotes(row[upvotesIdx]) : 0
    });
  }
  return results;
}

function parseJSON(content) {
  const data = JSON.parse(content);
  if (!Array.isArray(data)) {
    throw new Error("JSON import must be a top-level array of objects");
  }
  return data.map((item, idx) => ({
    rowNum: idx + 1,
    question: item.question || "",
    answer: item.answer || "",
    category: item.category || "General",
    tags: Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(",").map(t => t.trim()) : []),
    upvotes: normalizeUpvotes(item.upvotes)
  }));
}

function parseMarkdown(content) {
  const sections = content.split(/^#+\s+/m).filter(Boolean);
  const results = [];

  sections.forEach((sec, idx) => {
    const lines = sec.split(/\r?\n/);
    const question = lines[0].trim();
    const rest = lines.slice(1).join("\n").trim();
    if (!question && !rest) return;

    let answer = rest;
    let category = "General";
    let tags = [];
    let upvotes = 0;

    const metaLines = rest.split(/\r?\n/);
    const cleanedAnswerLines = [];
    metaLines.forEach((line) => {
      const lower = line.toLowerCase();
      if (lower.startsWith("category:")) {
        category = line.split(":")[1].trim();
      } else if (lower.startsWith("tags:")) {
        tags = line.split(":")[1].split(",").map(t => t.trim()).filter(Boolean);
      } else if (lower.startsWith("upvotes:") || lower.startsWith("votes:")) {
        upvotes = normalizeUpvotes(line.split(":")[1]);
      } else {
        cleanedAnswerLines.push(line);
      }
    });
    answer = cleanedAnswerLines.join("\n").trim();

    results.push({
      rowNum: idx + 1,
      question,
      answer,
      category,
      tags,
      upvotes
    });
  });

  return results;
}

async function importContent({ format, content, userId, authorName, dryRun = false }) {
  let parsed = [];
  try {
    const fmt = String(format).toLowerCase().trim();
    if (fmt === "json") {
      parsed = parseJSON(content);
    } else if (fmt === "csv") {
      parsed = parseCSV(content);
    } else if (fmt === "markdown" || fmt === "md") {
      parsed = parseMarkdown(content);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  } catch (err) {
    return {
      status: "error",
      message: `Failed to parse content: ${err.message}`,
      errors: [{ row: 0, error: err.message }]
    };
  }

  const errors = [];
  const validRows = [];

  parsed.forEach((row) => {
    const rowErrors = [];
    if (!row.question || row.question.trim().length < 10) {
      rowErrors.push("Question must be at least 10 characters long");
    }
    if (!row.answer || row.answer.trim().length < 5) {
      rowErrors.push("Answer must be at least 5 characters long");
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: row.rowNum,
        question: row.question,
        errors: rowErrors
      });
    } else {
      validRows.push(row);
    }
  });

  // If there are validation errors, do not write anything (avoid partial corrupt imports)
  if (errors.length > 0) {
    return {
      status: "invalid",
      message: `${errors.length} rows failed validation. Bulk import aborted.`,
      errors
    };
  }

  if (dryRun) {
    return {
      status: "valid",
      message: `Validation successful. ${validRows.length} rows ready to import.`,
      preview: validRows
    };
  }

  // Perform actual import
  const imported = [];
  for (const row of validRows) {
    const tagsString = row.tags.join(",");
    const upvotes = normalizeUpvotes(row.upvotes);

    if (isMongoAvailable()) {
      const faq = await FAQ.create({
        question: row.question,
        answer: row.answer,
        category: row.category,
        tags: row.tags,
        upvotes,
        userId,
        authorName
      });

      // Sync to SQLite fallback
      try {
        const db = getSQLiteDb();
        await db.run(
          `INSERT INTO faqs (mongo_id, question, answer, category, tags, upvotes, user_id, author_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          faq._id.toString(),
          row.question,
          row.answer,
          row.category,
          tagsString,
          upvotes,
          userId,
          authorName
        );
      } catch (sqliteErr) {
        console.error("SQLite import fallback sync failed:", sqliteErr.message);
      }

      imported.push({ id: faq._id.toString(), question: row.question });
    } else {
      const db = getSQLiteDb();
      const result = await db.run(
        `INSERT INTO faqs (question, answer, category, tags, upvotes, user_id, author_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row.question,
        row.answer,
        row.category,
        tagsString,
        upvotes,
        userId,
        authorName
      );

      imported.push({ id: result.lastID.toString(), question: row.question });
    }
  }

  return {
    status: "success",
    message: `Successfully imported ${imported.length} FAQs.`,
    imported
  };
}

async function extractTextFromDocument({ fileBuffer, fileName }) {
  const lower = String(fileName || "").toLowerCase();

  if (lower.endsWith(".pdf")) {
    const parsed = await pdfParse(fileBuffer);
    return parsed.text;
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  if (lower.endsWith(".txt")) {
    return fileBuffer.toString("utf8");
  }

  throw new Error("Unsupported document format. Supported formats are PDF, DOCX, and TXT.");
}

async function generateFaqPreviewFromDocument({ fileBuffer, fileName, userId, authorName }) {
  const extractedText = await extractTextFromDocument({ fileBuffer, fileName });

  if (!extractedText || extractedText.trim() === "") {
    throw new Error("Could not extract text from document");
  }

  let candidates = [];

  if (process.env.NODE_ENV === "test" || !process.env.GEMINI_API_KEY) {
    candidates = [
      {
        question: `Candidate FAQ from ${fileName}: Document Summary`,
        answer: extractedText.substring(0, 800).trim(),
        category: "General",
        tags: [],
        upvotes: 0
      }
    ];
  } else {
    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
Extract FAQ question-answer pairs from the following document text.
Return ONLY valid JSON. Do not include any markdown, code fences, or explanatory text.
Each item must include:
- "question": string
- "answer": string
- "category": string
- "tags": ["string"]
- "upvotes": integer (initial popularity score for the FAQ; default 0)

If a question is unclear, rewrite it to be clear and complete.
Remove duplicate FAQs.
Generate categories and tags when available.

Document Text:
${extractedText.substring(0, 10000)}
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const clean = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);

      if (!Array.isArray(parsed)) {
        throw new Error("AI returned invalid FAQ candidate structure");
      }

      candidates = parsed.map((item) => ({
        question: String(item.question || "").trim(),
        answer: String(item.answer || "").trim(),
        category: item.category ? String(item.category).trim() : "General",
        tags: Array.isArray(item.tags) ? item.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        upvotes: normalizeUpvotes(item.upvotes)
      }));
    } catch (err) {
      console.error("Gemini document FAQ extraction failed, fallback active:", err.message);
      // Heuristic fallback: split the document into multiple FAQ-sized chunks
      // instead of dumping the whole text into a single giant FAQ.
      candidates = buildFallbackFaqCandidates(extractedText, fileName);
    }
  }

  // Heuristic split: turns the document into several smaller FAQ candidates.
  // Used when Gemini is unavailable so admins still get multiple editable rows.
  function buildFallbackFaqCandidates(text, srcName) {
    if (!text || !text.trim()) {
      return [{
        question: `Candidate FAQ from ${srcName}: Document Summary`,
        answer: "",
        category: "General",
        tags: [],
        upvotes: 0
      }];
    }

    const TARGET_CHUNK_CHARS = 700;
    const MIN_CHUNK_CHARS = 120;

    // 1) Prefer splitting on paragraph boundaries (double newlines)
    let blocks = text
      .split(/\n\s*\n+/g)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 0);

    // 2) Fall back to sentence boundaries if paragraphs are too coarse
    if (blocks.length <= 1 && text.length > TARGET_CHUNK_CHARS * 1.5) {
      blocks = text
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    // 3) Greedy pack small blocks into ~700-char chunks; keep oversized
    //    blocks on their own rather than truncating them.
    const chunks = [];
    let buffer = "";
    for (const block of blocks) {
      if (block.length > TARGET_CHUNK_CHARS * 2) {
        if (buffer) { chunks.push(buffer.trim()); buffer = ""; }
        // Split very long blocks into ~700 char pieces at the nearest space
        let remaining = block;
        while (remaining.length > TARGET_CHUNK_CHARS) {
          let splitIdx = remaining.lastIndexOf(" ", TARGET_CHUNK_CHARS);
          if (splitIdx < MIN_CHUNK_CHARS) splitIdx = TARGET_CHUNK_CHARS;
          chunks.push(remaining.slice(0, splitIdx).trim());
          remaining = remaining.slice(splitIdx).trim();
        }
        if (remaining) buffer = remaining;
      } else if ((buffer + " " + block).trim().length > TARGET_CHUNK_CHARS) {
        if (buffer) chunks.push(buffer.trim());
        buffer = block;
      } else {
        buffer = buffer ? buffer + " " + block : block;
      }
    }
    if (buffer) chunks.push(buffer.trim());

    if (chunks.length === 0) {
      chunks.push(text.substring(0, TARGET_CHUNK_CHARS).trim());
    }

    return chunks.map((chunk, idx) => {
      // Use the first sentence/line as the FAQ question, fall back to a
      // numbered placeholder if the chunk has no obvious question sentence.
      const firstSentenceMatch = chunk.match(/^[^.!?\n]{6,160}[.!?]/);
      const derivedQuestion = firstSentenceMatch
        ? firstSentenceMatch[0].replace(/\s+/g, " ").trim()
        : `Candidate FAQ from ${srcName} (Part ${idx + 1})`;

      return {
        question: derivedQuestion,
        answer: chunk,
        category: "General",
        tags: [],
        upvotes: 0
      };
    });
  }

  const previewItems = await Promise.all(candidates.map(async (item, index) => {
    const validationErrors = [];
    if (!item.question || item.question.length < 10) {
      validationErrors.push("Question must be at least 10 characters long.");
    }
    if (!item.answer || item.answer.length < 5) {
      validationErrors.push("Answer must be at least 5 characters long.");
    }

    const duplicates = item.question ? await checkDuplicates(item.question, { persist: false }) : [];

    return {
      id: `preview-${index + 1}`,
      question: item.question,
      answer: item.answer,
      category: item.category || "General",
      tags: item.tags || [],
      upvotes: normalizeUpvotes(item.upvotes),
      validationErrors,
      duplicateScores: duplicates
    };
  }));

  return previewItems;
}

async function importFaqPreview({ faqs, userId, authorName }) {
  const payload = JSON.stringify(faqs.map((item) => ({
    question: item.question,
    answer: item.answer,
    category: item.category || "General",
    tags: Array.isArray(item.tags) ? item.tags : [],
    upvotes: normalizeUpvotes(item.upvotes)
  })));

  return importContent({
    format: "json",
    content: payload,
    userId,
    authorName,
    dryRun: false
  });
}

async function generateThreadFromDocument({ fileBuffer, fileName, userId, authorName }) {
  let parsedText = "";

  if (fileName.toLowerCase().endsWith(".pdf")) {
    const data = await pdfParse(fileBuffer);
    parsedText = data.text;
  } else {
    parsedText = fileBuffer.toString("utf8");
  }

  if (!parsedText || parsedText.trim() === "") {
    throw new Error("Could not extract text from document");
  }

  let extractedQAs = [];

  if (process.env.NODE_ENV === "test" || !process.env.GEMINI_API_KEY) {
    // Test mode/fallback candidate FAQ
    extractedQAs = [
      {
        question: `Candidate FAQ from ${fileName}: Document Purpose`,
        description: `This question was automatically generated from ${fileName}.`,
        answer: "This is a placeholder answer extracted for test validation purposes.",
        upvotes: 0
      }
    ];
  } else {
    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
Extract candidate FAQ questions and answers from the following text extracted from a document.
Return ONLY a valid JSON array of objects, where each object has:
- "question" (string, the extracted question, must be clear and complete, at least 10 characters)
- "description" (string, context/details from the document, at least 5 characters)
- "answer" (string, the extracted answer, at least 5 characters)
- "upvotes" (integer, initial popularity for the question; default 0)

Do not include any markdown formatting or prefix like \`\`\`json. Return only the JSON string.

Document Text:
${parsedText.substring(0, 10000)}
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const cleanJson = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      extractedQAs = JSON.parse(cleanJson);
    } catch (err) {
      console.error("Gemini document parsing failed, fallback active:", err.message);
      extractedQAs = [
        {
          question: `Candidate FAQ from ${fileName}: Document Summary`,
          description: `Extracted from ${fileName} due to AI parsing fallback.`,
          answer: parsedText.substring(0, 500),
          upvotes: 0
        }
      ];
    }
  }

  const results = [];

  for (const item of extractedQAs) {
    const questionText = item.question || "Untitled extracted question";
    const descriptionText = item.description || "";
    const answerText = item.answer || "";
    const upvotes = normalizeUpvotes(item.upvotes);

    if (isMongoAvailable()) {
      const query = await UserQuery.create({
        question: questionText,
        description: descriptionText,
        answer: answerText,
        status: "pending",
        source: "document_import",
        category: "General",
        tags: ["document-import"],
        upvotes,
        userId,
        authorName
      });

      try {
        const db = getSQLiteDb();
        await db.run(
          `INSERT INTO user_queries (mongo_id, question, answer, status, source, description, category, tags, upvotes, user_id, author_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          query._id.toString(),
          questionText,
          answerText,
          "pending",
          "document_import",
          descriptionText,
          "General",
          "document-import",
          upvotes,
          userId,
          authorName
        );
      } catch (err) {
        console.error("SQLite user_queries document import sync failed:", err.message);
      }

      results.push({
        id: query._id.toString(),
        question: questionText,
        description: descriptionText,
        answer: answerText,
        status: "pending",
        upvotes
      });
    } else {
      const db = getSQLiteDb();
      const sqliteResult = await db.run(
        `INSERT INTO user_queries (question, answer, status, source, description, category, tags, upvotes, user_id, author_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        questionText,
        answerText,
        "pending",
        "document_import",
        descriptionText,
        "General",
        "document-import",
        upvotes,
        userId,
        authorName
      );

      results.push({
        id: sqliteResult.lastID.toString(),
        question: questionText,
        description: descriptionText,
        answer: answerText,
        status: "pending",
        upvotes
      });
    }
  }

  return results;
}

module.exports = {
  importContent,
  generateFaqPreviewFromDocument,
  importFaqPreview,
  generateThreadFromDocument
};
