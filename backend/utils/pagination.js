function getPagination(query = {}) {
  // Cap is intentionally generous (5000) so admin-only listing endpoints
  // (e.g. /faqs/admin/all) can return every FAQ in one round trip. The
  // public listing endpoints should still use a smaller value if needed.
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 5000);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

module.exports = { getPagination };
