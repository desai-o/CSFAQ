const express = require("express");
const router = express.Router();
const { checkDuplicates } = require("../services/duplicateDetectionService");
const { requireAuth } = require("../middleware/auth");
const { success, fail } = require("../utils/apiResponse");

router.post("/check", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || question.trim() === "") {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Question is required for duplicate check"
      });
    }

    const duplicates = await checkDuplicates(question.trim());

    return success(res, {
      data: duplicates
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "DUPLICATE_CHECK_FAILED",
      message: "Failed to perform duplicate check",
      details: error.message
    });
  }
});

module.exports = router;
