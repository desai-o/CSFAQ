import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronUp, ChevronRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import Hashtag from "../components/Hashtag";
import { useFAQ } from "../context/FAQContext";
import { timeAgo } from "../utils/timeAgo";

const filters = ["All", "Unanswered", "Most Voted", "Newest"];

function Questions() {
  const { questions, upvoteQuestion, searchQuery, setSearchQuery, pagination, loadPage, backendOnline } = useFAQ();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

  // Only show community questions here — FAQs are displayed on the dedicated /faqs page.
  const communityQuestions = questions.filter((q) => q.sourceType !== "faq");

  // Advanced search states
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Collect unique tags dynamically from current community questions only
  const allTags = Array.from(
    new Set(communityQuestions.flatMap((q) => Array.isArray(q.hashtags) ? q.hashtags : []))
  ).filter(Boolean);

  const filteredTags = allTags.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.toLowerCase())
  );

  // Sync category dropdown changes
  const handleCategoryDropdownChange = (val) => {
    setSelectedCategory(val);
    if (val === "All Categories") {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([val]);
    }
  };

  const handleCategoryChipClick = (cat) => {
    let next;
    if (selectedCategories.includes(cat)) {
      next = selectedCategories.filter((c) => c !== cat);
    } else {
      next = [...selectedCategories, cat];
    }
    setSelectedCategories(next);

    if (next.length === 1) {
      setSelectedCategory(next[0]);
    } else if (next.length === 0) {
      setSelectedCategory("All Categories");
    } else {
      setSelectedCategory("All Categories");
    }
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedTags([]);
    setStatusFilter("all");
    setActiveFilter("All");
    setSelectedCategory("All Categories");
    setSearchQuery("");
    setTagSearch("");
  };

  const activeFiltersCount =
    selectedCategories.length +
    selectedTags.length +
    (statusFilter !== "all" ? 1 : 0) +
    (activeFilter !== "All" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  // Start filtering from community questions only (excludes FAQs)
  let filtered = [...communityQuestions];

  // Apply search query
  if (searchQuery.trim()) {
    const queryLower = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (q) =>
        (q.title || "").toLowerCase().includes(queryLower) ||
        (q.excerpt || "").toLowerCase().includes(queryLower) ||
        (q.description || "").toLowerCase().includes(queryLower) ||
        (Array.isArray(q.hashtags) && q.hashtags.some((tag) =>
          typeof tag === "string" && tag.toLowerCase().includes(queryLower)
        ))
    );
  }

  // Apply category filter (support multiple from advanced search panel)
  if (selectedCategories.length > 0) {
    filtered = filtered.filter((q) => q.category && selectedCategories.includes(q.category));
  } else if (selectedCategory !== "All Categories") {
    filtered = filtered.filter((q) => q.category === selectedCategory);
  }

  // Apply tag filter (support multiple tags)
  if (selectedTags.length > 0) {
    filtered = filtered.filter((q) =>
      selectedTags.every((tag) =>
        Array.isArray(q.hashtags) && q.hashtags.map((t) => String(t || "").toLowerCase()).includes(tag.toLowerCase())
      )
    );
  }

  // Apply status filter
  if (statusFilter === "resolved") {
    filtered = filtered.filter((q) => q.status === "resolved");
  } else if (statusFilter === "open") {
    filtered = filtered.filter((q) => q.status !== "resolved");
  }

  // Apply active tab filter & sorting
  if (activeFilter === "Unanswered") {
    filtered = filtered.filter((q) => !q.answers || q.answers.length === 0);
  } else if (activeFilter === "Most Voted") {
    filtered = filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  } else if (activeFilter === "Newest") {
    filtered = filtered.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />
        <main className="content">
          <h1 className="page-title">All Community Questions</h1>
          <p className="page-subtitle" style={{ marginTop: "-10px", marginBottom: "20px", color: "var(--text-secondary)" }}>
            Open questions from the community. Looking for curated answers? <Link to="/faqs" style={{ color: "var(--accent-blue)" }}>Visit the FAQs page →</Link>
          </p>

          <div className="questions-search-bar">
            <div className="questions-search-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={`advanced-search-toggle-btn ${showAdvanced ? "active" : ""}`}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filters</span>
              {activeFiltersCount > 0 && <span className="active-filter-badge">{activeFiltersCount}</span>}
            </button>

            <select
              className="category-dropdown"
              value={selectedCategory}
              onChange={(e) => handleCategoryDropdownChange(e.target.value)}
            >
              <option>All Categories</option>
              <option>Programming</option>
              <option>Artificial Intelligence</option>
              <option>Career</option>
              <option>Research</option>
              <option>Scholarships</option>
              <option>Mathematics</option>
            </select>
          </div>

          {showAdvanced && (
            <div className="advanced-filters-panel">
              <div className="filters-grid">
                <div className="filter-group">
                  <h4>Filter by Category</h4>
                  <div className="category-chips">
                    {["Programming", "Artificial Intelligence", "Career", "Research", "Scholarships", "Mathematics"].map((cat) => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`filter-chip ${isSelected ? "active" : ""}`}
                          onClick={() => handleCategoryChipClick(cat)}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="filter-group">
                  <h4>Filter by Tags</h4>
                  <div className="tag-search-container">
                    <input
                      type="text"
                      placeholder="Search tags..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="tag-search-input"
                    />
                  </div>
                  <div className="tag-chips">
                    {filteredTags.slice(0, 15).map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`filter-tag ${isSelected ? "active" : ""}`}
                          onClick={() => {
                            setSelectedTags((prev) =>
                              prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                            );
                          }}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                    {filteredTags.length === 0 && <span className="no-tags">No tags found</span>}
                  </div>
                </div>

                <div className="filter-group">
                  <h4>Sort & Status</h4>
                  <div className="filter-row">
                    <div className="filter-subgroup">
                      <h5>Sort By</h5>
                      <div className="btn-group">
                        <button
                          type="button"
                          className={`filter-btn ${activeFilter === "Newest" ? "active" : ""}`}
                          onClick={() => setActiveFilter("Newest")}
                        >
                          🕒 Newest
                        </button>
                        <button
                          type="button"
                          className={`filter-btn ${activeFilter === "Most Voted" ? "active" : ""}`}
                          onClick={() => setActiveFilter("Most Voted")}
                        >
                          ▲ Most Voted
                        </button>
                      </div>
                    </div>

                    <div className="filter-subgroup">
                      <h5>Status</h5>
                      <div className="btn-group">
                        <button
                          type="button"
                          className={`filter-btn ${statusFilter === "all" ? "active" : ""}`}
                          onClick={() => setStatusFilter("all")}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className={`filter-btn ${statusFilter === "resolved" ? "active" : ""}`}
                          onClick={() => setStatusFilter("resolved")}
                        >
                          Resolved
                        </button>
                        <button
                          type="button"
                          className={`filter-btn ${statusFilter === "open" ? "active" : ""}`}
                          onClick={() => setStatusFilter("open")}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="filters-footer">
                <div className="active-filters-summary">
                  {activeFiltersCount > 0 ? (
                    <span>Active filters: {activeFiltersCount} selected</span>
                  ) : (
                    <span>No filters applied</span>
                  )}
                </div>
                <button
                  type="button"
                  className="clear-filters-btn"
                  onClick={handleClearAll}
                >
                  ✕ Clear All Filters
                </button>
              </div>
            </div>
          )}

          <div className="filter-tabs">
            <div className="filter-tabs-left">
              {filters.map((f) => (
                <button
                  key={f}
                  className={`tab-btn ${activeFilter === f ? "tab-active" : ""}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="results-count">
              📄 {filtered.length} questions
            </span>
          </div>

          <section className="question-list-flat faq-expandable-list">
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ textAlign: "center", padding: "40px 20px" }}>
                <span className="empty-icon" style={{ fontSize: "48px" }}>🔍</span>
                <h3>No questions found</h3>
                <p>Try resetting filters or typing a different search keyword.</p>
              </div>
            ) : (
              filtered.map((q, index) => (
                <div key={q.id} className={`faq-expandable`}>
                  <div
                    className="faq-expandable-header"
                    onClick={() => navigate(`/questions/${q.id}`)}
                    role="button"
                    aria-label={`Open question: ${q.title}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/questions/${q.id}`);
                      }
                    }}
                  >
                    <div className="vote-col">
                      <button
                        className={`upvote ${q.voted ? "upvoted" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          upvoteQuestion(q.id);
                        }}
                        aria-label="Upvote question"
                      >
                        <ChevronUp size={20} />
                      </button>
                      <span className="vote-count">{q.votes}</span>
                    </div>

                    <div className="faq-expandable-body question-body">
                      <div className="q-tags">
                        {q.answers && q.answers.length > 0 && <span className="tag answered">✓ Answered</span>}
                        <span className="tag category">{q.category}</span>
                        <span className="tag content-type-badge">Question</span>
                        <span className={`tag status-badge ${q.status || "pending"}`}>
                          {q.status === "resolved" ? "Resolved" : "Open"}
                        </span>
                      </div>

                      <h3 className="q-title">{q.title}</h3>

                      <p className="q-excerpt">{q.excerpt}</p>

                      <div className="q-footer">
                        <div className="q-hashtags">
                          {q.hashtags.map((tag) => (
                            <Hashtag key={tag} tag={tag} />
                          ))}
                        </div>
                        <div className="q-meta">
                          👤 {q.author || "Community"} &nbsp; 💬 {q.answers ? q.answers.length : 0} answers &nbsp; 👁 {q.views ?? 0} views &nbsp; <span className="time-ago">{timeAgo(q.createdAt || q.time)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="faq-expandable-chevron" aria-hidden="true">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                  {index !== filtered.length - 1 && <div className="divider"></div>}
                </div>
              ))
            )}
          </section>

          {/* Pagination Controls */}
          {backendOnline && pagination && pagination.total > pagination.limit && (
            <div className="pagination-controls" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginTop: "20px", marginBottom: "20px" }}>
              <button
                disabled={pagination.offset === 0}
                onClick={() => loadPage(Math.floor(pagination.offset / pagination.limit) - 1)}
                className="pagination-btn btn-secondary"
                style={{ padding: "8px 16px", cursor: pagination.offset === 0 ? "not-allowed" : "pointer" }}
              >
                Previous
              </button>
              <span className="pagination-info" style={{ color: "#eee" }}>
                Page {Math.floor(pagination.offset / pagination.limit) + 1} of {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button
                disabled={pagination.offset + pagination.limit >= pagination.total}
                onClick={() => loadPage(Math.floor(pagination.offset / pagination.limit) + 1)}
                className="pagination-btn btn-secondary"
                style={{ padding: "8px 16px", cursor: (pagination.offset + pagination.limit >= pagination.total) ? "not-allowed" : "pointer" }}
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>
      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

export default Questions;
