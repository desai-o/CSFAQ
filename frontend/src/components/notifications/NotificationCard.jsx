import { useState } from "react";
import { getNotificationId, isNotificationRead, getNotificationCreatedAt, getNotificationType, formatRelativeTime, typeIcons, typeColors } from "./utils";

function NotificationCard({ notification, onMarkRead, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const id = getNotificationId(notification);
  const read = isNotificationRead(notification);
  const createdAt = getNotificationCreatedAt(notification);
  const type = getNotificationType(notification);
  const icon = typeIcons[type] || typeIcons.general;
  const color = typeColors[type] || typeColors.general;

  async function handleMarkRead(e) {
    e.stopPropagation();
    if (read) return;
    try {
      await onMarkRead(id);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }

  async function handleDelete(e) {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onDelete(id);
    } catch (err) {
      console.error("Failed to delete notification:", err);
      setDeleting(false);
    }
  }

  return (
    <div
      className={`notification-card ${read ? "" : "unread"}`}
      role="menuitem"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleMarkRead(e); }}
    >
      <div
        className="notification-card-icon"
        style={{ color }}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="notification-card-body">
        <p className="notification-card-message">
          {notification.message || "Someone interacted with your post."}
        </p>
        {notification.description && (
          <p className="notification-card-description">{notification.description}</p>
        )}
        <span className="notification-card-time">
          {formatRelativeTime(createdAt)}
        </span>
      </div>

      <div className="notification-card-actions">
        {!read && (
          <button
            className="notification-action-btn mark-read"
            onClick={handleMarkRead}
            title="Mark as read"
            aria-label="Mark as read"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
        <button
          className="notification-action-btn delete"
          onClick={handleDelete}
          disabled={deleting}
          title="Delete notification"
          aria-label="Delete notification"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default NotificationCard;
