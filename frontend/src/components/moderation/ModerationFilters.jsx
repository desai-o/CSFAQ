import { CATEGORIES } from "./mockModerationData";

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "faq", label: "FAQ" },
  { value: "question", label: "Question" },
  { value: "answer", label: "Answer" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending_review", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "escalated", label: "Escalated" },
];

const SORT_OPTIONS = [
  { value: "most_recent", label: "Most Recent" },
  { value: "most_reported", label: "Most Reported" },
  { value: "oldest", label: "Oldest First" },
];

export default function ModerationFilters({
  filters,
  onChange,
  totalCount,
  filteredCount,
}) {
  const isFiltered =
    filters.search.trim() ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.sort !== "most_recent";

  function clearAll() {
    onChange({
      search: "",
      type: "all",
      status: "all",
      category: "all",
      sort: "most_recent",
    });
  }

  return (
    <div className="mod-filters">
      {/* Search */}
      <div className="mod-search-row">
        <div className="mod-search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            id="mod-search-input"
            placeholder="Search by content, author, or tag…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            aria-label="Search moderation queue"
          />
          {filters.search && (
            <button
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", lineHeight: 1, padding: 0 }}
              onClick={() => onChange({ ...filters, search: "" })}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          className="mod-filter-select"
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value })}
          aria-label="Sort order"
          id="mod-sort-select"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Type chips */}
      <div className="mod-filter-row">
        <span className="mod-filter-label">Type:</span>
        <div className="mod-chip-group">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              id={`mod-type-${o.value}`}
              className={`mod-chip ${filters.type === o.value ? "active" : ""}`}
              onClick={() => onChange({ ...filters, type: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status chips */}
      <div className="mod-filter-row">
        <span className="mod-filter-label">Status:</span>
        <div className="mod-chip-group">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              id={`mod-status-${o.value}`}
              className={`mod-chip ${filters.status === o.value ? "active" : ""}`}
              onClick={() => onChange({ ...filters, status: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category + meta row */}
      <div className="mod-filter-row" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="mod-filter-label">Category:</span>
          <select
            className="mod-filter-select"
            value={filters.category}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            id="mod-category-select"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="mod-filter-meta" style={{ margin: 0 }}>
          <span className="mod-filter-count">
            Showing <strong>{filteredCount}</strong> of {totalCount}
          </span>
          {isFiltered && (
            <button
              className="mod-clear-filters"
              onClick={clearAll}
              style={{ marginLeft: "12px" }}
              id="mod-clear-filters-btn"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
