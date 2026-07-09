const express = require("express");
const router = express.Router();
const { runChatAssistant } = require("../services/chatRetrievalService");
const { GoogleGenAI } = require("@google/genai");
const { requireAuth } = require("../middleware/auth");
const { success, fail } = require("../utils/apiResponse");

/**
 * Public endpoint that reports whether the Gemini API key is configured
 * and (lightweight) whether a probe call to the Generative Language API succeeds.
 * Used by the chat widget to decide whether to show the "online" green dot.
 */
router.get("/status", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const configured = Boolean(apiKey && apiKey.trim().length > 0);

  if (!configured) {
    return success(res, {
      data: {
        configured: false,
        working: false,
        offline: true
      }
    });
  }

  // Lightweight probe — confirm the credentials authenticate against the
  // Generative Language API. If anything throws, we treat the chatbot as
  // offline (the green "online" dot in the UI should never appear).
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "ping"
    });
    const text = response && typeof response.text === "string" ? response.text : "";
    const working = text.length > 0;
    return success(res, {
      data: {
        configured: true,
        working,
        offline: !working
      }
    });
  } catch (error) {
    console.warn("Gemini status probe failed:", error.message);
    return success(res, {
      data: {
        configured: true,
        working: false,
        offline: true,
        error: error.message
      }
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || message.trim() === "") {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Message is required"
      });
    }

    const userId = req.user?.id || "anonymous";
    const result = await runChatAssistant({ message, history, userId });

    return success(res, {
      data: result
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "CHAT_ASSISTANT_FAILED",
      message: "Chat assistant error occurred",
      details: error.message
    });
  }
});

module.exports = router;