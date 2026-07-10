const rateLimit = require("express-rate-limit");

const standardHandler = (req, res, next, options) => {
  return res.status(options.statusCode).json({
    status: "error",
    code: "TOO_MANY_REQUESTS",
    message: options.message || "Too many requests, please try again later."
  });
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

module.exports = {
  authLimiter,
  searchLimiter,
  aiLimiter,
  writeLimiter
};
