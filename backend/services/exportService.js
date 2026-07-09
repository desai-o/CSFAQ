const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const Answer = require("../models/Answer");
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
const { formatFaqsForExport } = require("./aiService");

function buildFilters(query) {
  const { category, tag, user, startDate, endDate } = query || {};
  const mongoFilter = {};
  const sqliteConditions = [];
  const sqliteParams = [];

  if (category) {
    mongoFilter.category = category;
    sqliteConditions.push("category = ?");
    sqliteParams.push(category);
  }
  if (tag) {
    mongoFilter.tags = tag;
    sqliteConditions.push("tags LIKE ?");
    sqliteParams.push(`%${tag}%`);
  }
  if (user) {
    mongoFilter.userId = user;
    sqliteConditions.push("user_id = ?");
    sqliteParams.push(user);
  }
  if (startDate || endDate) {
    mongoFilter.createdAt = {};
    if (startDate) {
      mongoFilter.createdAt.$gte = new Date(startDate);
      sqliteConditions.push("created_at >= ?");
      sqliteParams.push(startDate);
    }
    if (endDate) {
      mongoFilter.createdAt.$lte = new Date(endDate);
      sqliteConditions.push("created_at <= ?");
      sqliteParams.push(endDate);
    }
  }

  return { mongoFilter, sqliteConditions, sqliteParams };
}

async function fetchExportData(filters) {
  const { mongoFilter, sqliteConditions, sqliteParams } = filters;

  if (isMongoAvailable()) {
    const faqs = await FAQ.find(mongoFilter).lean();
    const faqIds = faqs.map((f) => f._id);
    const answers = await Answer.find({ questionId: { $in: faqIds } }).lean();

    const answersMap = {};
    answers.forEach((ans) => {
      if (!ans.questionId) return;
      const qId = ans.questionId.toString();
      if (!answersMap[qId]) answersMap[qId] = [];
      answersMap[qId].push(ans);
    });

    return faqs.map((faq) => ({
      id: faq._id.toString(),
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      tags: faq.tags || [],
      authorName: faq.authorName || "Anonymous",
      userId: faq.userId,
      createdAt: faq.createdAt,
      staleScore: faq.staleScore || 0,
      lastReviewedAt: faq.lastReviewedAt,
      needsUpdate: faq.needsUpdate || false,
      updateReason: faq.updateReason || "",
      additionalAnswers: (answersMap[faq._id.toString()] || []).map((ans) => ({
        id: ans._id.toString(),
        content: ans.content,
        authorName: ans.authorName || "Community Member",
        votes: ans.votes || 0,
        isVerified: ans.isVerified || false,
        createdAt: ans.createdAt
      }))
    }));
  } else {
    const db = getSQLiteDb();
    let query = "SELECT * FROM faqs";
    if (sqliteConditions.length > 0) {
      query += " WHERE " + sqliteConditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";

    const faqs = await db.all(query, ...sqliteParams);
    const faqIds = faqs.map((f) => f.id);

    if (faqIds.length === 0) return [];

    const placeholders = faqIds.map(() => "?").join(",");
    const answers = await db.all(
      `SELECT * FROM answers WHERE question_id IN (${placeholders})`,
      ...faqIds
    );

    const answersMap = {};
    answers.forEach((ans) => {
      const qId = String(ans.question_id);
      if (!answersMap[qId]) answersMap[qId] = [];
      answersMap[qId].push(ans);
    });

    return faqs.map((faq) => ({
      id: String(faq.id),
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      tags: faq.tags ? faq.tags.split(",").filter(Boolean) : [],
      authorName: faq.author_name || "Anonymous",
      userId: faq.user_id,
      createdAt: new Date(faq.created_at),
      staleScore: faq.stale_score || 0,
      lastReviewedAt: faq.last_reviewed_at ? new Date(faq.last_reviewed_at) : null,
      needsUpdate: Boolean(faq.needs_update),
      updateReason: faq.update_reason || "",
      additionalAnswers: (answersMap[String(faq.id)] || []).map((ans) => ({
        id: String(ans.id),
        content: ans.content,
        authorName: ans.author_name || ans.author || "Community Member",
        votes: ans.votes || 0,
        isVerified: Boolean(ans.is_verified),
        createdAt: new Date(ans.created_at)
      }))
    }));
  }
}

function escapeCSV(val) {
  if (val === null || val === undefined) return "";
  let str = String(val);
  str = str.replace(/"/g, '""');
  if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

async function exportAsJSON(query) {
  const filters = buildFilters(query);
  const data = await fetchExportData(filters);
  return JSON.stringify(data, null, 2);
}

async function exportAsCSV(query) {
  const filters = buildFilters(query);
  const data = await fetchExportData(filters);

  const headers = ["ID", "Question", "Answer", "Category", "Tags", "Author", "Created At", "Additional Answers Count"];
  const rows = [headers.join(",")];

  for (const faq of data) {
    const row = [
      escapeCSV(faq.id),
      escapeCSV(faq.question),
      escapeCSV(faq.answer),
      escapeCSV(faq.category),
      escapeCSV(faq.tags.join(";")),
      escapeCSV(faq.authorName),
      escapeCSV(faq.createdAt.toISOString ? faq.createdAt.toISOString() : faq.createdAt),
      escapeCSV(faq.additionalAnswers.length)
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

async function exportAsMarkdown(query) {
  const filters = buildFilters(query);
  const data = await fetchExportData(filters);

  let md = `# CrowdFAQ Knowledge Export\n`;
  md += `Generated on: ${new Date().toISOString().split("T")[0]}\n\n`;

  if (data.length === 0) {
    md += `*No FAQs matched the filter criteria.*\n`;
    return md;
  }

  for (const [idx, faq] of data.entries()) {
    md += `## ${idx + 1}. ${faq.question}\n\n`;
    md += `- **Category:** ${faq.category}\n`;
    md += `- **Tags:** ${faq.tags.join(", ") || "None"}\n`;
    md += `- **Author:** ${faq.authorName}\n`;
    md += `- **Created At:** ${faq.createdAt.toISOString ? faq.createdAt.toISOString() : faq.createdAt}\n\n`;
    
    md += `### Main Answer:\n\n${faq.answer}\n\n`;

    if (faq.additionalAnswers.length > 0) {
      md += `### Additional Community Answers:\n\n`;
      for (const ans of faq.additionalAnswers) {
        md += `--- \n\n`;
        md += `*Answer by ${ans.authorName} (${ans.votes} votes${ans.isVerified ? ", Verified" : ""}):*\n\n`;
        md += `${ans.content}\n\n`;
      }
    }
    md += `\n---\n\n`;
  }

  return md;
}

function generatePdfFromStructuredExport(structuredExport, res) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);

      doc.fontSize(22).text(structuredExport.title || "CrowdFAQ Knowledge Export", { align: "center" });
      doc.fontSize(10).text(`Generated on: ${new Date().toISOString().split("T")[0]}`, { align: "center" });
      doc.moveDown(2);

      if (structuredExport.summary) {
        doc.fontSize(12).fillColor("#202124").text(structuredExport.summary, { align: "left" });
        doc.moveDown(1.5);
      }

      if (!structuredExport.sections || structuredExport.sections.length === 0) {
        doc.fontSize(12).text("No FAQ data available for export.", { align: "center" });
        doc.end();
        return resolve();
      }

      doc.fontSize(16).fillColor("#1a73e8").text("Table of Contents", { underline: true });
      doc.moveDown(0.5);
      structuredExport.sections.forEach((section, index) => {
        doc.fontSize(11).fillColor("#202124").text(`${index + 1}. ${section.heading}`, {
          indent: 10
        });
      });
      doc.addPage();

      structuredExport.sections.forEach((section, sectionIndex) => {
        doc.fontSize(18).fillColor("#1a73e8").text(section.heading);
        doc.moveDown(0.5);

        section.faqs.forEach((faq, faqIndex) => {
          const headingNumber = `${sectionIndex + 1}.${faqIndex + 1}`;
          doc.fontSize(14).fillColor("#0f172a").text(`${headingNumber} ${faq.question}`);
          doc.moveDown(0.35);
          doc.fontSize(10).fillColor("#475569").text(`Category: ${faq.category} | Tags: ${faq.tags.join(", ") || "None"}`);
          doc.moveDown(0.3);
          doc.fontSize(11).fillColor("#111827").text(faq.answer);
          doc.moveDown(1);
        });

        if (sectionIndex < structuredExport.sections.length - 1) {
          doc.addPage();
        }
      });

      doc.end();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function createDocxDocument(structuredExport) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: structuredExport.title || "CrowdFAQ Knowledge Export",
            heading: HeadingLevel.TITLE,
            spacing: { after: 300 }
          }),
          new Paragraph({
            text: `Generated on: ${new Date().toISOString().split("T")[0]}`,
            spacing: { after: 300 }
          }),
          ...(structuredExport.summary ? [
            new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: structuredExport.summary, spacing: { after: 300 } })
          ] : []),
          new Paragraph({ text: "Table of Contents", heading: HeadingLevel.HEADING_2 }),
          ...structuredExport.sections.map((section, index) =>
            new Paragraph({ text: `${index + 1}. ${section.heading}`, bullet: { level: 0 } })
          ),
          new Paragraph({ text: "" })
        ]
      }
    ]
  });

  structuredExport.sections.forEach((section, sectionIndex) => {
    doc.addSection({
      properties: {},
      children: [
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 }
        }),
        ...section.faqs.flatMap((faq, faqIndex) => [
          new Paragraph({
            text: `${sectionIndex + 1}.${faqIndex + 1} ${faq.question}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({ text: `Category: ${faq.category} | Tags: ${faq.tags.join(", ") || "None"}`, spacing: { after: 100 } }),
          new Paragraph({ text: faq.answer, spacing: { after: 300 } })
        ])
      ]
    });
  });

  return doc;
}

async function exportAsAIPDF(query, res) {
  const filters = buildFilters(query);
  const data = await fetchExportData(filters);
  const structured = await formatFaqsForExport(data, { mode: "ai" });
  await generatePdfFromStructuredExport(structured, res);
}

async function exportAsAIDOCX(query, res) {
  const filters = buildFilters(query);
  const data = await fetchExportData(filters);
  const structured = await formatFaqsForExport(data, { mode: "ai" });
  const doc = createDocxDocument(structured);
  const buffer = await Packer.toBuffer(doc);
  res.send(buffer);
}

async function exportAsDOCX(query, res) {
  const filters = buildFilters(query);
  const data = await fetchExportData(filters);
  const structured = {
    title: "CrowdFAQ Knowledge Export",
    summary: `This export contains ${data.length} FAQs grouped by category.`,
    sections: data.reduce((acc, faq) => {
      const heading = faq.category || "General";
      const existing = acc.find((section) => section.heading === heading);
      const item = {
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        tags: faq.tags || []
      };
      if (existing) {
        existing.faqs.push(item);
      } else {
        acc.push({ heading, faqs: [item] });
      }
      return acc;
    }, [])
  };

  const doc = createDocxDocument(structured);
  const buffer = await Packer.toBuffer(doc);
  res.send(buffer);
}

function exportAsPDF(query, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const filters = buildFilters(query);
      const data = await fetchExportData(filters);

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);

      // Title
      doc.fontSize(22).text("CrowdFAQ Knowledge Platform Export", { align: "center" });
      doc.fontSize(10).text(`Generated on: ${new Date().toISOString().split("T")[0]}`, { align: "center" });
      doc.moveDown(2);

      if (data.length === 0) {
        doc.fontSize(12).text("No FAQ data available for export.", { align: "center" });
        doc.end();
        return resolve();
      }

      for (const [idx, faq] of data.entries()) {
        doc.fontSize(14).fillColor("#1a73e8").text(`${idx + 1}. ${faq.question}`);
        doc.moveDown(0.5);

        // Metadata block
        doc.fontSize(9).fillColor("#5f6368");
        doc.text(`Category: ${faq.category}  |  Tags: ${faq.tags.join(", ") || "None"}  |  Author: ${faq.authorName}`);
        const dateStr = faq.createdAt.toISOString ? faq.createdAt.toISOString() : faq.createdAt;
        doc.text(`Created At: ${dateStr}`);
        doc.moveDown(0.5);

        // Main Answer
        doc.fontSize(11).fillColor("#202124").text("Canonical Answer:", { underline: true });
        doc.moveDown(0.2);
        doc.fontSize(11).text(faq.answer);
        doc.moveDown(1);

        // Additional Answers
        if (faq.additionalAnswers && faq.additionalAnswers.length > 0) {
          doc.fontSize(11).text("Community Answers:", { underline: true });
          doc.moveDown(0.2);

          for (const ans of faq.additionalAnswers) {
            doc.fontSize(10).fillColor("#5f6368");
            let badge = "";
            if (ans.isVerified) badge += " [VERIFIED]";
            doc.text(`By ${ans.authorName} (${ans.votes} votes)${badge}:`);
            doc.moveDown(0.1);
            doc.fontSize(10).fillColor("#202124").text(ans.content);
            doc.moveDown(0.6);
          }
        }

        doc.moveDown(1);
        doc.strokeColor("#e0e0e0").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1.5);
      }

      doc.end();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  exportAsJSON,
  exportAsCSV,
  exportAsMarkdown,
  exportAsPDF,
  exportAsAIPDF,
  exportAsDOCX,
  exportAsAIDOCX
};
