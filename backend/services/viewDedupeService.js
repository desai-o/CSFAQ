// Per-viewer deduplication for question/FAQ view counters.
//
// Background
// ──────────
// A naive `POST /:id/view` endpoint will inflate the counter on every page
// reload, browser tab reopen, or browser-back-button click. Real-world view
// counts are almost always deduplicated per viewer within a time window so
// the count reflects "how many distinct times this question was opened" and
// not "how many HTTP calls landed here".
//
// This module keeps an in-memory map of recent viewers keyed by
// `{targetType}:{viewerKey}:{targetId} -> lastSeenAtMs` and tells the caller
// whether the current request should increment the counter. The map is
// garbage-collected once it grows past `MAX_ENTRIES` so we don't leak memory
// on a long-running server.
//
// The dedup window is configurable via `VIEW_DEDUPE_WINDOW_MS` (default
// 30 minutes). Setting it to 0 disables dedup entirely (every request
// increments), which is useful for tests and for systems that want raw
// counts.
//
// Viewer identity (most specific first):
//   1. `req.user.id` if the request is authenticated (but only a real id —
//      see note in getViewerKey about the `anonymous` stub from optionalAuth)
//   2. `x-anonymous-id` header (the client picks a stable random ID and
//      persists it in localStorage so the same browser is recognised across
//      reloads)
//   3. The request's IP address (last resort — shared across users behind the
//      same NAT/proxy)

const DEFAULT_DEDUPE_WINDOW_MS = Number(
  process.env.VIEW_DEDUPE_WINDOW_MS || 30 * 60 * 1000
);
const MAX_ENTRIES = 10000;

const recentViews = new Map();

function getNow() {
  return Date.now();
}

function buildKey(targetType, viewerKey, targetId) {
  return `${targetType}:${viewerKey}:${String(targetId)}`;
}

function getViewerKey(req) {
  // `optionalAuth` middleware sets `req.user = { id: "anonymous", ... }`
  // whenever no Bearer token is present. That stub identity MUST NOT
  // collapse every unauthenticated viewer into one bucket, or a reload
  // from a different "anonymous" browser would be treated as the same
  // viewer. Only treat the request as an identified user when there is a
  // real (non-"anonymous") user id.
  if (req && req.user && req.user.id && req.user.id !== "anonymous") {
    return `user:${req.user.id}`;
  }

  const headerVal = req && req.headers && req.headers["x-anonymous-id"];
  if (typeof headerVal === "string" && headerVal.trim().length > 0) {
    return `anon:${headerVal.trim().slice(0, 128)}`;
  }

  // req.ip is populated by Express when `app.set('trust proxy', ...)` is on
  // (or `app.listen()` is configured to trust the loopback). We also fall
  // back to a common forwarded-for header for setups behind a reverse proxy.
  const ip =
    (req && req.ip) ||
    (req &&
      req.headers &&
      req.headers["x-forwarded-for"] &&
      req.headers["x-forwarded-for"].split(",")[0] &&
      req.headers["x-forwarded-for"].split(",")[0].trim()) ||
    (req && req.socket && req.socket.remoteAddress) ||
    "unknown";
  return `ip:${ip}`;
}

function shouldRecordView({
  targetType,
  targetId,
  req,
  windowMs = DEFAULT_DEDUPE_WINDOW_MS
}) {
  const viewerKey = getViewerKey(req);
  const result = { record: true, viewerKey, deduped: false, lastSeen: null };

  if (!targetId) return result;

  // windowMs <= 0 means dedup is disabled — always record.
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return result;
  }

  const key = buildKey(targetType, viewerKey, targetId);
  const now = getNow();
  const lastSeen = recentViews.get(key);

  if (lastSeen && now - lastSeen < windowMs) {
    // Same viewer within the window — refresh the timestamp so the dedup
    // window slides forward (a user browsing for an hour still only counts
    // as one view), but don't re-increment the counter.
    recentViews.set(key, now);
    return { record: false, viewerKey, deduped: true, lastSeen };
  }

  recentViews.set(key, now);

  // Garbage-collect stale entries once we grow past the cap. We delete a
  // little aggressively to keep this O(1) on the hot path.
  if (recentViews.size > MAX_ENTRIES) {
    const cutoff = now - windowMs;
    for (const [k, ts] of recentViews.entries()) {
      if (ts < cutoff) recentViews.delete(k);
    }
    // If we still overflow (e.g. every entry is fresh), drop the oldest
    // half by clearing the entire map. The next request from each viewer
    // will simply start a fresh dedup window, which is acceptable.
    if (recentViews.size > MAX_ENTRIES) {
      recentViews.clear();
    }
  }

  return result;
}

// Test helper — wipes the in-memory map so each test starts fresh.
function clearRecentViews() {
  recentViews.clear();
}

// Test helper — returns the number of tracked entries.
function getRecentViewCount() {
  return recentViews.size;
}

module.exports = {
  shouldRecordView,
  getViewerKey,
  clearRecentViews,
  getRecentViewCount,
  DEFAULT_DEDUPE_WINDOW_MS
};
