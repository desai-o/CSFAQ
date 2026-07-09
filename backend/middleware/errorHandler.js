function notFound(req, res, next) {
  return res.status(404).json({
    status: "error",
    code: "ROUTE_NOT_FOUND",
    message: "Route not found",
    path: req.originalUrl
  });
}

function errorHandler(error, req, res, next) {
  console.error("Unhandled backend error:", {
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });

  return res.status(error.statusCode || 500).json({
    status: "error",
    code: error.code || "INTERNAL_SERVER_ERROR",
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {})
  });
}

module.exports = {
  notFound,
  errorHandler
};
