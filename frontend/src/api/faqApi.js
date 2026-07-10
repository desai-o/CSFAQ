const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}, attempt = 0) {
  const token = localStorage.getItem("crowdfaq-token");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const err = new Error(payload.message || payload.error || `Request failed: ${response.status}`);
      // Attach the full payload so callers (e.g. BulkPostingPanel) can read
      // validation `details` returned by the backend, plus the status code.
      err.status = response.status;
      err.details = payload.details;
      err.payload = payload;
      throw err;
    }

    return payload;
  } catch (error) {
    // Preserve any extra fields (status, details, payload) we attached above
    // when retrying or re-throwing — `new Error(...)` chained without
    // re-attaching them would otherwise drop them.
    const enriched = Object.assign(error instanceof Error ? error : new Error(String(error)), {
      status: error?.status,
      details: error?.details,
      payload: error?.payload,
    });

    const retryable =
      enriched.name === "AbortError" ||
      enriched.message.includes("Failed to fetch") ||
      enriched.message.includes("NetworkError");

    if (retryable && enriched.status === undefined && attempt < MAX_RETRIES) {
      await sleep(300 * 2 ** attempt);
      return request(path, options, attempt + 1);
    }

    throw enriched;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFaqs(limit = 20, offset = 0) {
  return request(`/faqs?limit=${limit}&offset=${offset}`);
}

export async function fetchFaqById(id) {
  return request(`/faqs/${encodeURIComponent(id)}`);
}

// Bump the view counter for a FAQ when its detail page is opened.
// Failures are swallowed — analytics should never block the UI.
export async function incrementFaqView(id) {
  try {
    return await request(`/faqs/${encodeURIComponent(id)}/view`, {
      method: "POST"
    });
  } catch (error) {
    console.warn("incrementFaqView failed for", id, error);
    return null;
  }
}

export async function fetchQueries(limit = 20, offset = 0) {
  return request(`/queries?limit=${limit}&offset=${offset}`);
}

// Bump the view counter for an unresolved user query when its detail page is opened.
// Failures are swallowed — analytics should never block the UI.
export async function incrementQueryView(id) {
  try {
    return await request(`/queries/${encodeURIComponent(id)}/view`, {
      method: "POST"
    });
  } catch (error) {
    console.warn("incrementQueryView failed for", id, error);
    return null;
  }
}

export async function searchFaq(keyword) {
  return request("/search", {
    method: "POST",
    body: JSON.stringify({ keyword })
  });
}

export async function submitQuery(payload) {
  return request("/queries", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createFaq(payload) {
  return request("/faqs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function submitAnswer(payload) {
  return request("/answers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchAnswers(questionId, limit = 20, offset = 0) {
  return request(`/answers/${questionId}?limit=${limit}&offset=${offset}`);
}

export async function toggleVote(payload) {
  return request("/votes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function toggleBookmarkApi(payload) {
  return request("/bookmarks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchBookmarks() {
  return request(`/bookmarks`);
}

export async function fetchOverviewStats() {
  return request("/stats/overview");
}

export async function fetchActivityStats(range = "week") {
  return request(`/stats/activity?range=${range}`);
}

export async function fetchHeatmapStats(range = "week") {
  return request(`/stats/heatmap?range=${range}`);
}

export async function fetchAdminOverview() {
  return request("/admin/overview");
}

export async function fetchPendingQueries() {
  return request("/admin/pending-queries");
}

export async function deleteFaq(id) {
  return request(`/faqs/${id}`, {
    method: "DELETE"
  });
}

export async function updateFaq(id, payload) {
  return request(`/faqs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteQuery(id) {
  return request(`/queries/${id}`, {
    method: "DELETE"
  });
}

export async function updateQuery(id, payload) {
  return request(`/queries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteAnswer(id) {
  return request(`/answers/${id}`, {
    method: "DELETE"
  });
}

export async function updateAnswer(id, payload) {
  return request(`/answers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function followResource(followableType, followableId) {
  return request("/follows", {
    method: "POST",
    body: JSON.stringify({ followableType, followableId })
  });
}

export async function unfollowResource(followId) {
  return request(`/follows/${followId}`, {
    method: "DELETE"
  });
}

export async function muteFollow(followId, isMuted) {
  return request(`/follows/${followId}/mute`, {
    method: "PATCH",
    body: JSON.stringify({ isMuted })
  });
}

// Fetch all follows for the currently-authenticated user.
// Optionally filtered server-side by `type` ("question" | "tag").
export async function fetchMyFollows(type) {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  return request(`/follows${qs}`);
}

// Fetch questions/FAQs that match the user's followed tags or
// followed question IDs. Returns a normalized list suitable for the
// Subscription page.
export async function fetchFollowedFeed() {
  return request(`/follows/feed`);
}

export async function fetchNotifications() {
  return request("/notifications");
}

export async function markNotificationsAsRead() {
  return request("/notifications/read", {
    method: "PATCH"
  });
}

export function markNotificationAsRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, {
    method: "PATCH"
  });
}

export function deleteNotification(notificationId) {
  return request(`/notifications/${notificationId}`, {
    method: "DELETE"
  });
}

export async function checkDuplicatesApi(question) {
  return request("/duplicates/check", {
    method: "POST",
    body: JSON.stringify({ question })
  });
}

export async function sendChatMessage(message, history = []) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ message, history })
  });
}

export async function fetchChatStatus() {
  return request("/chat/status");
}

export async function createBounty(payload) {
  return request("/bounties", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function awardBounty(bountyId, payload) {
  return request(`/bounties/${bountyId}/award`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchBounties() {
  return request("/bounties");
}

export async function fetchNotificationPreferences() {
  return request("/notifications/preferences");
}

export async function updateNotificationPreferences(preferences) {
  return request("/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences)
  });
}

export async function fetchKnowledgeGaps() {
  return request("/admin/knowledge-gaps");
}

export async function previewFaqImport(fileName, fileContent) {
  return request("/faqs/import/preview", {
    method: "POST",
    body: JSON.stringify({ fileName, fileContent })
  });
}

export async function confirmFaqImport(faqs) {
  return request("/faqs/import/confirm", {
    method: "POST",
    body: JSON.stringify({ faqs })
  });
}

// Admin-only: list ALL FAQs (no moderation filter). Used by the
// Bulk Edit tab so admins can also see FAQs in needs_review / rejected.
export async function fetchAdminAllFaqs(limit = 500, offset = 0) {
  return request(`/faqs/admin/all?limit=${limit}&offset=${offset}`);
}

// Admin-only: apply the same set of field changes to many FAQs.
// `items` is an array of { id, updates } where `updates` matches the
// PATCH /faqs/:id body (every field optional).
export async function bulkEditFaqs(items) {
  return request("/faqs/bulk-edit", {
    method: "POST",
    body: JSON.stringify({ items })
  });
}

// Admin-only: delete many FAQs in one round trip.
export async function bulkDeleteFaqs(ids) {
  return request("/faqs/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids })
  });
}

export async function downloadFaqExport(format, mode = "raw") {
  const token = localStorage.getItem("crowdfaq-token");
  const response = await fetch(`${API_BASE_URL}/export?format=${encodeURIComponent(format)}&mode=${encodeURIComponent(mode)}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Export failed with status ${response.status}`);
  }

  const blob = await response.blob();
  return blob;
}

export async function queryGraphQL(query, variables = {}) {
  return request("/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables })
  });
}

export async function fetchContributorLeaderboard() {
  return request("/contributors/leaderboard");
}

export const submitReport = async (reportData) => {
  try {
    const token = localStorage.getItem("crowdfaq-token");
    if (!token) throw new Error("Authentication required to submit reports.");
    
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(reportData)
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to submit report.");
    }
    return result;
  } catch (err) {
    console.error("submitReport error:", err);
    throw err;
  }
};
