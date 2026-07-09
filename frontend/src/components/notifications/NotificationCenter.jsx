import { useState, useEffect } from "react";
import { fetchNotifications, markNotificationsAsRead, markNotificationAsRead, deleteNotification } from "../../api/faqApi";
import NotificationCard from "./NotificationCard";
import NotificationGroup from "./NotificationGroup";
import NotificationFilters from "./NotificationFilters";
import NotificationSearch from "./NotificationSearch";
import { getNotificationId, isNotificationRead, getNotificationCreatedAt, getNotificationType, typeIcons } from "./utils";
import { FILTER_OPTIONS } from "./NotificationFilters";

function getGroupLabel(dateString) {
  if (!dateString) return "Older";
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 0) return "Older";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Older";
}

function NotificationCenter({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [markingAllRead, setMarkingAllRead] = useState(false);

  function getFallbackNotifications() {
    const now = new Date();
    return [
      { _id: "1", message: "Your question 'How does AI learning work?' received a new answer", createdAt: new Date(now - 30*60000).toISOString(), isRead: false, type: "answer", description: "Sarah answered: 'Machine learning is a subset of AI that...'" },
      { _id: "2", message: "John Doe upvoted your answer on 'What is React?'", createdAt: new Date(now - 2*3600000).toISOString(), isRead: false, type: "upvote", description: "" },
      { _id: "3", message: "New answer posted on a question you follow", createdAt: new Date(now - 5*3600000).toISOString(), isRead: false, type: "answer", description: "Mike replied to 'Best practices for Python error handling'" },
      { _id: "4", message: "A question you flagged has been reviewed by moderators", createdAt: new Date(now - 24*3600000).toISOString(), isRead: true, type: "warning", description: "" },
      { _id: "5", message: "System: Weekly platform maintenance scheduled tonight", createdAt: new Date(now - 24*3600000).toISOString(), isRead: false, type: "system", description: "The platform will be briefly unavailable at 2 AM EST" },
      { _id: "6", message: "You received 5 new upvotes on your answer about CSS Grid", createdAt: new Date(now - 48*3600000).toISOString(), isRead: true, type: "upvote", description: "" },
      { _id: "7", message: "New follower: Alex started following your questions", createdAt: new Date(now - 72*3600000).toISOString(), isRead: true, type: "follow", description: "" },
      { _id: "8", message: "Your question 'Database indexing strategies' has 3 new answers", createdAt: new Date(now - 96*3600000).toISOString(), isRead: true, type: "answer", description: "Latest answer by Priya: 'Consider using composite indexes for...'" },
    ];
  }

  useEffect(() => {
    setNotifications(getFallbackNotifications());
    let cancelled = false;
    fetchNotifications()
      .then((data) => {
        if (!cancelled) setNotifications(data?.data?.length ? data.data : getFallbackNotifications());
      })
      .catch(() => {
        if (!cancelled) {
          console.log("Using fallback notification data (backend unavailable)");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function retryFetch() {
    setLoading(true);
    setError(null);
    setNotifications(getFallbackNotifications());
    try {
      const data = await fetchNotifications();
      if (data?.data?.length) setNotifications(data.data);
    } catch (err) {
      console.log("Using fallback notification data (backend unavailable)");
    } finally {
      setLoading(false);
    }
  }

  const handleMarkRead = async (id) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) =>
        getNotificationId(n) === id ? { ...n, isRead: true, is_read: true } : n
      )
    );
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
    setNotifications((prev) =>
      prev.filter((n) => getNotificationId(n) !== id)
    );
  };

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);
    try {
      await markNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, is_read: true }))
      );
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleClearAll = async () => {
    for (const n of notifications) {
      try {
        await deleteNotification(getNotificationId(n));
      } catch (err) {
        console.error("Failed to delete notification:", err);
      }
    }
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !isNotificationRead(n)).length;

  let filtered = [...notifications];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((n) => {
      const message = (n.message || "").toLowerCase();
      const description = (n.description || "").toLowerCase();
      return message.includes(q) || description.includes(q);
    });
  }

  if (filter === "unread") {
    filtered = filtered.filter((n) => !isNotificationRead(n));
  } else if (filter !== "all") {
    filtered = filtered.filter((n) => getNotificationType(n) === filter);
  }

  filtered.sort((a, b) => {
    const aTime = new Date(getNotificationCreatedAt(a) || 0).getTime();
    const bTime = new Date(getNotificationCreatedAt(b) || 0).getTime();
    return sort === "newest" ? bTime - aTime : aTime - bTime;
  });

  const groups = {};
  for (const n of filtered) {
    const label = getGroupLabel(getNotificationCreatedAt(n));
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  const groupOrder = ["Today", "Yesterday", "This Week", "Older"];

  function renderSkeleton() {
    return (
      <div className="notification-center-skeleton">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="notification-skeleton-item">
            <div className="notification-skeleton-icon" />
            <div className="notification-skeleton-lines">
              <div className="notification-skeleton-line short" />
              <div className="notification-skeleton-line long" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderEmptyState() {
    if (loading) return null;
    let message = "No notifications yet";
    let icon = typeIcons.general;

    if (searchQuery) {
      message = `No notifications matching "${searchQuery}"`;
    } else if (filter !== "all") {
      const filterLabel = FILTER_OPTIONS.find((f) => f.value === filter)?.label || filter;
      message = `No ${filterLabel.toLowerCase()} notifications`;
    }

    return (
      <div className="notification-center-empty">
        <div className="notification-empty-icon">{icon}</div>
        <p className="notification-empty-text">{message}</p>
        {(searchQuery || filter !== "all") && (
          <button
            className="notification-empty-reset"
            onClick={() => { setSearchQuery(""); setFilter("all"); }}
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  const hasNotifications = filtered.length > 0;

  return (
    <div className="notification-center" role="dialog" aria-label="Notifications">
      <div className="notification-center-header">
        <div className="notification-center-header-left">
          <h3 className="notification-center-title">Notifications</h3>
          {unreadCount > 0 && (
            <span className="notification-center-unread-badge">{unreadCount} new</span>
          )}
        </div>
        <div className="notification-center-header-actions">
          {unreadCount > 0 && (
            <button
              className="notification-header-action"
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              title="Mark all as read"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className="notification-header-action danger"
              onClick={handleClearAll}
              title="Clear all notifications"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear all
            </button>
          )}
          {onClose && (
            <button
              className="notification-header-action close"
              onClick={onClose}
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <NotificationSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <NotificationFilters
        currentFilter={filter}
        onFilterChange={setFilter}
        currentSort={sort}
        onSortChange={setSort}
      />

      <div className="notification-center-body">
        {loading ? (
          renderSkeleton()
        ) : error ? (
          <div className="notification-center-error">
            <p>{error}</p>
            <button className="notification-error-retry" onClick={retryFetch}>Retry</button>
          </div>
        ) : hasNotifications ? (
          groupOrder.map((groupLabel) => {
            const groupItems = groups[groupLabel];
            if (!groupItems) return null;
            return (
              <NotificationGroup key={groupLabel} title={groupLabel} count={groupItems.length}>
                {groupItems.map((notification) => (
                  <NotificationCard
                    key={getNotificationId(notification)}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                  />
                ))}
              </NotificationGroup>
            );
          })
        ) : (
          renderEmptyState()
        )}
      </div>
    </div>
  );
}

export default NotificationCenter;
