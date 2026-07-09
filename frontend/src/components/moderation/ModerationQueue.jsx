import ModerationCard from "./ModerationCard";

export default function ModerationQueue({
  items,
  selectedId,
  onSelect,
  onAction,
  loading,
  error,
  onRetry,
}) {
  if (loading) {
    return (
      <div className="mod-queue" aria-label="Loading moderation queue" aria-busy="true">
        {[1, 2, 3].map((n) => (
          <div key={n} className="mod-skeleton-card">
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div className="mod-skeleton-line" style={{ width: "60px", height: "20px" }} />
              <div className="mod-skeleton-line" style={{ width: "90px", height: "20px" }} />
            </div>
            <div className="mod-skeleton-line" style={{ width: "85%", height: "18px" }} />
            <div className="mod-skeleton-line" style={{ width: "100%", height: "14px" }} />
            <div className="mod-skeleton-line" style={{ width: "75%", height: "14px" }} />
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
              <div className="mod-skeleton-line" style={{ width: "120px", height: "14px" }} />
              <div className="mod-skeleton-line" style={{ width: "60px", height: "14px" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mod-error-state" role="alert">
        <div className="mod-error-icon">⚠️</div>
        <h3 className="mod-error-title">Failed to Load Queue</h3>
        <p className="mod-error-sub">{error}</p>
        <button className="mod-retry-btn" onClick={onRetry} id="mod-retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mod-empty-state" role="status">
        <div className="mod-empty-icon">🎉</div>
        <h3 className="mod-empty-title">All Clear!</h3>
        <p className="mod-empty-sub">
          No items match your current filters. Try adjusting your search or clearing active filters to see more content.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mod-queue"
      role="list"
      aria-label={`${items.length} items in moderation queue`}
    >
      {items.map((item) => (
        <div key={item.id} role="listitem">
          <ModerationCard
            item={item}
            isSelected={selectedId === item.id}
            onClick={onSelect}
            onAction={onAction}
          />
        </div>
      ))}
    </div>
  );
}
