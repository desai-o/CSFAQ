const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  exportAsJSON,
  exportAsCSV,
  exportAsMarkdown,
  exportAsPDF,
  exportAsAIPDF,
  exportAsDOCX,
  exportAsAIDOCX
} = require("../services/exportService");
const { fail } = require("../utils/apiResponse");

const exportQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    format: z.enum(["json", "csv", "markdown", "pdf", "docx"]).default("json"),
    mode: z.enum(["raw", "ai"]).default("raw"),
    category: z.string().trim().optional(),
    tag: z.string().trim().optional(),
    user: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional()
  })
});

router.get("/", requireAuth, requireRole("admin"), validate(exportQuerySchema), async (req, res) => {
  try {
    const { format, mode } = req.validated.query;

    if (format === "json") {
      if (mode !== "raw") {
        return fail(res, { statusCode: 400, code: "INVALID_MODE", message: "AI export mode is only supported for pdf and docx." });
      }
      const data = await exportAsJSON(req.validated.query);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="faqs.json"');
      return res.send(data);
    }

    if (format === "csv") {
      if (mode !== "raw") {
        return fail(res, { statusCode: 400, code: "INVALID_MODE", message: "AI export mode is only supported for pdf and docx." });
      }
      const data = await exportAsCSV(req.validated.query);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="faqs.csv"');
      return res.send(data);
    }

    if (format === "markdown") {
      if (mode !== "raw") {
        return fail(res, { statusCode: 400, code: "INVALID_MODE", message: "AI export mode is only supported for pdf and docx." });
      }
      const data = await exportAsMarkdown(req.validated.query);
      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", 'attachment; filename="faqs.md"');
      return res.send(data);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="faqs.pdf"');
      if (mode === "ai") {
        await exportAsAIPDF(req.validated.query, res);
      } else {
        await exportAsPDF(req.validated.query, res);
      }
      return;
    }

    if (format === "docx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", 'attachment; filename="faqs.docx"');
      if (mode === "ai") {
        await exportAsAIDOCX(req.validated.query, res);
      } else {
        await exportAsDOCX(req.validated.query, res);
      }
      return;
    }

    return fail(res, { statusCode: 400, code: "INVALID_FORMAT", message: "Unsupported format" });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "EXPORT_FAILED", message: error.message });
  }
});

module.exports = router;
