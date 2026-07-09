const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "answer", label: "Answers" },
  { value: "question", label: "Questions" },
  { value: "upvote", label: "Upvotes" },
  { value: "warning", label: "Warnings" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

function NotificationFilters({ currentFilter, onFilterChange, currentSort, onSortChange }) {
  return (
    <div className="notification-center-filters">
      <div className="notification-filter-chips">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`notification-filter-chip ${currentFilter === opt.value ? "active" : ""}`}
            onClick={() => onFilterChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="notification-sort">
        <label className="notification-sort-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="21" y1="4" x2="14" y2="4" />
            <line x1="10" y1="4" x2="3" y2="4" />
            <line x1="21" y1="12" x2="12" y2="12" />
            <line x1="8" y1="12" x2="3" y2="12" />
            <line x1="21" y1="20" x2="10" y2="20" />
            <line x1="6" y1="20" x2="3" y2="20" />
          </svg>
        </label>
        <select
          className="notification-sort-select"
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default NotificationFilters;
export { FILTER_OPTIONS, SORT_OPTIONS };
