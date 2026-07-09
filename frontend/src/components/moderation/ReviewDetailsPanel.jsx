import { useState } from "react";
import { STATUS_CONFIG, TYPE_CONFIG, formatRelativeTime } from "./mockModerationData";

export default function ReviewDetailsPanel({ item, onAction, onClose, onSaveNote }) {
  const [noteSaved, setNoteSaved] = useState(false);
  const [localNote, setLocalNote] = useState(item?.notes || "");

  // Sync note when item changes
  if (item && localNote !== item.notes && !noteSaved) {
    // Only sync on item switch; we track via key on parent
  }

  function handleSaveNote() {
    onSaveNote(item.id, localNote);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  if (!item) {
    return (
      <aside className="mod-details-panel" aria-label="Content detail panel">
        <div className="mod-details-empty">
          <div className="mod-details-empty-icon">📋</div>
          <p>Select a content item from the queue to inspect its full details and take action.</p>
        </div>
      </aside>
    );
  }

  const typeConfig = TYPE_CONFIG[item.type] || {};
  const statusConfig = STATUS_CONFIG[item.status] || {};
  const isPending = item.status === "pending_review";
  const isActioned = item.status === "approved" || item.status === "rejected";

  const ACTION_ICONS = {
    submitted: "📝",
    "auto-flagged": "🤖",
    flagged: "⚑",
    approved: "✅",
    rejected: "❌",
    escalated: "🔺",
  };

  return (
    <aside
      className="mod-details-panel"
      key={item.id}
      aria-label={`Details for: ${item.title}`}
    >
      {/* Panel header */}
      <div className="mod-details-header">
        <div className="mod-details-header-badges">
          <span
            className="mod-type-badge"
            style={{ background: typeConfig.bg, color: typeConfig.color, padding: "3px 10px", borderRadius: "50px", fontSize: "11px", fontWeight: 700 }}
          >
            {typeConfig.label}
          </span>
          <span
            className="mod-status-badge"
            style={{ background: statusConfig.bg, color: statusConfig.color, padding: "3px 10px", borderRadius: "50px", fontSize: "11px", fontWeight: 700 }}
          >
            {statusConfig.icon} {statusConfig.label}
          </span>
        </div>
        <button
          className="mod-close-btn"
          onClick={onClose}
          id="mod-details-close-btn"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="mod-details-body">
        {/* Full content */}
        <section aria-labelledby="mod-content-section">
          <div className="mod-section-label" id="mod-content-section">Full Content</div>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 10px", lineHeight: 1.4 }}>
            {item.title}
          </h3>
          <div className="mod-full-body">{item.body}</div>
        </section>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <section>
            <div className="mod-section-label">Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "50px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    background: "rgba(59,130,246,0.1)",
                    color: "var(--accent-blue)",
                    border: "1px solid rgba(59,130,246,0.2)",
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Author card */}
        <section aria-labelledby="mod-author-section">
          <div className="mod-section-label" id="mod-author-section">Author</div>
          <div className="mod-author-card">
            <div
              className="mod-author-avatar-lg"
              style={{ background: item.author.color }}
              aria-hidden="true"
            >
              {item.author.initial}
            </div>
            <div>
              <p className="mod-author-name">{item.author.name}</p>
              <div className="mod-author-stats">
                <span className="mod-author-stat">
                  <span>{item.author.reputation.toLocaleString()}</span>
                  reputation
                </span>
                <span className="mod-author-stat">
                  <span>{item.author.postCount}</span>
                  posts
                </span>
                <span className="mod-author-stat">
                  Joined{" "}
                  {new Date(item.author.joinDate).toLocaleDateString("en-IN", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Report info */}
        {item.reportReason && (
          <section aria-labelledby="mod-report-section">
            <div className="mod-section-label" id="mod-report-section">Report Information</div>
            <div className="mod-report-info">
              <div className="mod-report-reason-pill">
                ⚑ {item.reportReason}
              </div>
              <p className="mod-report-count-text">
                {item.reportCount === 0
                  ? "No community reports yet — flagged by automated systems."
                  : `Reported ${item.reportCount} time${item.reportCount !== 1 ? "s" : ""} by community members.`}
              </p>
            </div>
          </section>
        )}

        {/* Moderation history */}
        <section aria-labelledby="mod-history-section">
          <div className="mod-section-label" id="mod-history-section">Moderation History</div>
          <div className="mod-history-timeline">
            {[...item.moderationHistory].reverse().map((entry, idx) => (
              <div key={idx} className="mod-history-item">
                <div className="mod-history-dot" aria-hidden="true">
                  {ACTION_ICONS[entry.action] || "•"}
                </div>
                <div className="mod-history-content">
                  <div className="mod-history-action">{entry.action.replace(/-/g, " ")}</div>
                  <div className="mod-history-by">by {entry.moderator}</div>
                  {entry.reason && (
                    <div className="mod-history-reason">"{entry.reason}"</div>
                  )}
                  <div className="mod-history-time">
                    {new Date(entry.timestamp).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Moderator notes */}
        <section aria-labelledby="mod-notes-section">
          <div className="mod-section-label" id="mod-notes-section">Moderator Notes</div>
          <div className="mod-notes-section">
            <textarea
              id={`mod-notes-textarea-${item.id}`}
              className="mod-notes-textarea"
              placeholder="Add private notes visible only to moderators…"
              value={localNote}
              onChange={(e) => {
                setLocalNote(e.target.value);
                setNoteSaved(false);
              }}
              rows={3}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end" }}>
              {noteSaved && (
                <span className="mod-note-saved">✓ Note saved</span>
              )}
              <button
                className="mod-save-note-btn"
                onClick={handleSaveNote}
                disabled={localNote === item.notes && !noteSaved}
                id={`mod-save-note-btn-${item.id}`}
              >
                Save Note
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Action bar */}
      <div className="mod-details-actions">
        {isPending ? (
          <>
            <div className="mod-action-row">
              <button
                className="mod-action-btn approve"
                onClick={() => onAction(item.id, "approve")}
                id={`mod-action-approve-${item.id}`}
                aria-label="Approve this content"
              >
                ✓ Approve
              </button>
              <button
                className="mod-action-btn reject"
                onClick={() => onAction(item.id, "reject")}
                id={`mod-action-reject-${item.id}`}
                aria-label="Reject this content"
              >
                ✕ Reject
              </button>
            </div>
            <div className="mod-action-row">
              <button
                className="mod-action-btn escalate"
                onClick={() => onAction(item.id, "escalate")}
                id={`mod-action-escalate-${item.id}`}
                aria-label="Escalate this content"
              >
                🔺 Escalate
              </button>
              <button
                className="mod-action-btn flag"
                onClick={() => onAction(item.id, "flag")}
                id={`mod-action-flag-${item.id}`}
                aria-label="Flag this content for review"
              >
                ⚑ Flag for Review
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)", padding: "6px 0" }}>
            {statusConfig.icon} This item has been <strong style={{ color: "var(--text-primary)" }}>{statusConfig.label}</strong> and cannot be re-actioned.
          </div>
        )}
      </div>
    </aside>
  );
}
