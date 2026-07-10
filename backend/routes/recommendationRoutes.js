const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth");
const { getPersonalizedRecommendations } = require("../services/recommendationService");
const { success, fail } = require("../utils/apiResponse");

router.get("/faqs", optionalAuth, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const userId = req.user ? req.user.id : "anonymous";
    const data = await getPersonalizedRecommendations(userId, limit);
    return success(res, { data });
  } catch (error) {
    return fail(res, { statusCode: 500, code: "RECOMMENDATION_FAILED", message: error.message });
  }
});

module.exports = router;
