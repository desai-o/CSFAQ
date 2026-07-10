function success(res, { statusCode = 200, storage, data, meta = {} }) {
  return res.status(statusCode).json({
    status: "success",
    storage,
    data,
    meta
  });
}

function fail(res, { statusCode = 400, code = "BAD_REQUEST", message, details }) {
  return res.status(statusCode).json({
    status: "error",
    code,
    message,
    ...(details ? { details } : {})
  });
}

module.exports = { success, fail };
