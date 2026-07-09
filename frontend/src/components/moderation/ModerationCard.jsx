import { STATUS_CONFIG, TYPE_CONFIG, formatRelativeTime } from "./mockModerationData";

export default function ModerationCard({ item, isSelected, onClick, onAction }) {
  const typeConfig = TYPE_CONFIG[item.type] || {};
  const statusConfig = STATUS_CONFIG[item.status] || {};
  const isUrgent = item.reportCount >= 10;

  function handleQuickAction(e, action) {
    e.stopPropagation(); // Don't trigger card select
    onAction(item.id, action);
  }

  return (
    <article
      id={`mod-card-${item.id}`}
      className={`mod-card ${isSelected ? "selected" : ""}`}
      onClick={() => onClick(item.id)}
      aria-selected={isSelected}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(item.id); }}
    >
      {/* Header row */}
      <div className="mod-card-header">
        <div className="mod-card-badges">
          {/* Content type badge */}
          <span
            className="mod-type-badge"
            style={{ background: typeConfig.bg, color: typeConfig.color }}
          >
            {typeConfig.label}
          </span>

          {/* Status badge */}
          <span
            className="mod-status-badge"
            style={{ background: statusConfig.bg, color: statusConfig.color }}
          >
            {statusConfig.icon} {statusConfig.label}
          </span>
        </div>

        {/* Report count + time */}
        <div className="mod-card-meta">
          {item.reportCount > 0 && (
            <span
              className="mod-report-badge"
              title={`${item.reportCount} reports`}
              style={isUrgent ? { background: "rgba(239,68,68,0.18)", fontWeight: 800 } : {}}
            >
              {isUrgent ? "🔥" : "⚑"} {item.reportCount}
            </span>
          )}
          <span className="mod-card-time">{formatRelativeTime(item.createdAt)}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="mod-card-title">{item.title}</h3>

      {/* Body preview */}
      <p className="mod-card-preview">{item.body}</p>

      {/* Footer */}
      <div className="mod-card-footer">
        <div className="mod-card-author">
          <div
            className="mod-author-avatar"
            style={{ background: item.author.color }}
            aria-hidden="true"
          >
            {item.author.initial}
          </div>
          <span>{item.author.name}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="mod-card-category">{item.category}</span>
        </div>
      </div>

      {/* Quick action buttons (only for pending items) */}
      {item.status === "pending_review" && (
        <div className="mod-card-quick-actions">
          <button
            className="mod-quick-btn approve"
            onClick={(e) => handleQuickAction(e, "approve")}
            id={`mod-quick-approve-${item.id}`}
            aria-label={`Approve: ${item.title}`}
          >
            ✓ Approve
          </button>
          <button
            className="mod-quick-btn reject"
            onClick={(e) => handleQuickAction(e, "reject")}
            id={`mod-quick-reject-${item.id}`}
            aria-label={`Reject: ${item.title}`}
          >
            ✕ Reject
          </button>
          <button
            className="mod-quick-btn escalate"
            onClick={(e) => handleQuickAction(e, "escalate")}
            id={`mod-quick-escalate-${item.id}`}
            aria-label={`Escalate: ${item.title}`}
          >
            ↑ Escalate
          </button>
        </div>
      )}
    </article>
  );
}
