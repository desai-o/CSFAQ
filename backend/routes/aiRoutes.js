const express = require("express");
const router = express.Router();

const { generateSummary } = require("../services/aiService");
const { aiLimiter } = require("../middleware/rateLimits");
const { success, fail } = require("../utils/apiResponse");

router.post("/summary", aiLimiter, async (req, res) => {
  try {
    const { question, answers } = req.body;

    const summary = await generateSummary(question, answers);

    return success(res, {
      data: { summary }
    });
  } catch (error) {
    console.error(error);

    return fail(res, {
      statusCode: 500,
      code: "SUMMARY_GENERATION_FAILED",
      message: "Failed to generate summary",
      details: error.message
    });
  }
});

module.exports = router;