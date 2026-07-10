import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import { useFAQ } from "../context/FAQContext";
import { fetchFaqs } from "../api/faqApi";
import { timeAgo } from "../utils/timeAgo";

/* ---------- Normalisation helpers ---------- */
const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const getTags = (faq) => {
  if (Array.isArray(faq.tags) && faq.tags.length) return faq.tags;
  if (Array.isArray(faq.hashtags) && faq.hashtags.length) return faq.hashtags;
  if (typeof faq.tags === "string" && faq.tags.trim()) {
    return faq.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
  }
  return [];
};

const getCategory = (faq) =>
  faq.category || (faq.categories && faq.categories[0]) || "";

const sortOptions = ["Newest", "Most Voted", "Most Viewed"];

export default function FAQs() {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { questions, upvoteQuestion } = useFAQ();

  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Advanced filter state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [sortFilter, setSortFilter] = useState("Newest");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const faqData = await fetchFaqs(50, 0);
        if (cancelled) return;
        const arr = Array.isArray(faqData)
          ? faqData
          : Array.isArray(faqData?.data)
          ? faqData.data
          : Array.isArray(faqData?.items)
          ? faqData.items
          : [];
        // Map backend FAQ shape to a friendlier internal shape
        const mapped = arr.map((f) => ({
          ...f,
          _id: f._id || f.id,
          id: f.id || f._id,
          sourceType: "faq",
          title: f.question || f.title || "",
          answer: f.answer || f.description || f.content || "",
          excerpt: stripHtml(f.answer || f.description || f.content || "").slice(0, 180),
          category: f.category || "General",
          hashtags: Array.isArray(f.tags)
            ? f.tags
            : typeof f.tags === "string"
            ? f.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean)
            : [],
          tags: Array.isArray(f.tags)
            ? f.tags
            : typeof f.tags === "string"
            ? f.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean)
            : [],
          votes: f.votes || f.upvotes || 0,
          upvotes: f.votes || f.upvotes || 0,
          voted: false,
          views: f.views || 0,
          updatedAt: f.updatedAt || f.updated_at || f.createdAt || f.created_at,
          createdAt: f.createdAt || f.created_at
        }));
        setFaqs(mapped);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load FAQs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge with FAQContext for live vote state
  const faqsWithLiveState = useMemo(() => {
    return faqs.map((f) => {
      const fid = String(f._id || f.id);
      const live = questions.find((q) => {
        const qid = String(q.id || q._id || q.mongo_id || "");
        return q.sourceType === "faq" && qid === fid;
      });
      if (!live) return f;
      return {
        ...f,
        voted: live.voted ?? f.voted,
        votes: live.votes ?? f.votes
      };
    });
  }, [faqs, questions]);

  /* ---- Build category list dynamically from FAQs ---- */
  const categories = useMemo(() => {
    const map = new Map();
    faqsWithLiveState.forEach((f) => {
      const cat = getCategory(f);
      if (cat && !map.has(cat)) map.set(cat, 0);
      if (cat) map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [faqsWithLiveState]);

  /* ---- Build tag list dynamically from FAQs ---- */
  const allTags = useMemo(() => {
    return Array.from(
      new Set(faqsWithLiveState.flatMap((f) => getTags(f)))
    ).filter(Boolean);
  }, [faqsWithLiveState]);

  const filteredTags = useMemo(
    () =>
      allTags.filter((tag) =>
        tag.toLowerCase().includes(tagSearch.toLowerCase())
      ),
    [allTags, tagSearch]
  );

  /* ---- Filter FAQs by search + category + tags + sort ---- */
  const filteredFAQs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let result = faqsWithLiveState.filter((f) => {
      const cat = getCategory(f);

      // Advanced multi-select category filter takes priority over the legacy top-bar chip
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(cat)) return false;
      } else if (selectedCategory !== "all" && cat !== selectedCategory) {
        return false;
      }

      // Multi-tag filter (require all selected tags to be present)
      if (selectedTags.length > 0) {
        const fTags = getTags(f).map((t) => String(t || "").toLowerCase());
        const allMatch = selectedTags.every((t) =>
          fTags.includes(String(t).toLowerCase())
        );
        if (!allMatch) return false;
      }

      if (!q) return true;
      const haystack = `${f.title || ""} ${stripHtml(f.answer || "")} ${cat} ${getTags(f).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });

    // Sorting
    if (sortFilter === "Most Voted") {
      result = [...result].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else if (sortFilter === "Most Viewed") {
      result = [...result].sort((a, b) => (b.views || 0) - (a.views || 0));
    } else {
      // Newest first by createdAt (fall back to updatedAt)
      result = [...result].sort((a, b) => {
        const da = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const db = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return db - da;
      });
    }

    return result;
  }, [faqsWithLiveState, searchQuery, selectedCategory, selectedCategories, selectedTags, sortFilter]);

  const activeFiltersCount =
    selectedCategories.length +
    selectedTags.length +
    (sortFilter !== "Newest" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const handleCategoryChipClick = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedTags([]);
    setSortFilter("Newest");
    setSearchQuery("");
    setTagSearch("");
    setSelectedCategory("all");
  };

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />
        <main className="content">
          {/* Page Header */}
          <section className="categories-hero">
            <div className="categories-hero-content">
              <h1 className="categories-title">Frequently Asked Questions</h1>
              <p className="categories-subtitle">
                Find quick answers to common questions from the community. Click any FAQ to open it
                and discover related discussions. Got a new question?{" "}
                <Link to="/questions" style={{ color: "var(--accent-blue)" }}>
                  Ask the community →
                </Link>
              </p>
            </div>
          </section>

          {/* Search + Filters row (same pattern as Questions page) */}
          <div className="questions-search-bar">
            <div className="questions-search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search FAQs..."
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
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                if (e.target.value === "all") {
                  setSelectedCategories([]);
                } else {
                  setSelectedCategories([e.target.value]);
                }
              }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {showAdvanced && (
            <div className="advanced-filters-panel">
              <div className="filters-grid">
                <div className="filter-group">
                  <h4>Filter by Category</h4>
                  <div className="category-chips">
                    {categories.length === 0 && (
                      <span className="no-tags">No categories found</span>
                    )}
                    {categories.map((c) => {
                      const isSelected = selectedCategories.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          className={`filter-chip ${isSelected ? "active" : ""}`}
                          onClick={() => handleCategoryChipClick(c.name)}
                        >
                          {c.name}
                          <span style={{ marginLeft: "6px", opacity: 0.7, fontSize: "11px" }}>
                            ({c.count})
                          </span>
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
                  <h4>Sort By</h4>
                  <div className="btn-group">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`filter-btn ${sortFilter === opt ? "active" : ""}`}
                        onClick={() => setSortFilter(opt)}
                      >
                        {opt === "Newest" && "🕒 "}
                        {opt === "Most Voted" && "▲ "}
                        {opt === "Most Viewed" && "👁 "}
                        {opt}
                      </button>
                    ))}
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

          {/* Result count + sort tabs */}
          <div className="filter-tabs">
            <div className="filter-tabs-left">
              {sortOptions.map((f) => (
                <button
                  key={f}
                  className={`tab-btn ${sortFilter === f ? "tab-active" : ""}`}
                  onClick={() => setSortFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="results-count">
              📄 {filteredFAQs.length} FAQs
            </span>
          </div>

          {/* FAQ List */}
          <section className="question-list-flat faq-expandable-list">
            {loading && <div className="loading-state">Loading FAQs…</div>}
            {error && <div className="error-state">{error}</div>}

            {!loading && filteredFAQs.length === 0 && (
              <div className="empty-state" style={{ textAlign: "center", padding: "40px 20px" }}>
                <span className="empty-icon" style={{ fontSize: "48px" }}>🔍</span>
                <h3>No FAQs found</h3>
                <p>Try resetting filters or typing a different search keyword.</p>
              </div>
            )}

            {!loading && filteredFAQs.map((faq, index) => {
              const id = faq._id || faq.id;
              return (
                <div key={id} className="faq-expandable">
                  {/* FAQ card header (clickable → detail page) */}
                  <div
                    className="faq-expandable-header"
                    onClick={() => navigate(`/faqs/${id}`)}
                    role="button"
                    aria-label={`Open FAQ: ${faq.title}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/faqs/${id}`);
                      }
                    }}
                  >
                    <div className="vote-col">
                      <button
                        className={`upvote ${faq.voted ? "upvoted" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          upvoteQuestion(id);
                        }}
                        aria-label="Upvote FAQ"
                      >
                        <ChevronUp size={20} />
                      </button>
                      <span className="vote-count">{faq.votes ?? 0}</span>
                    </div>
                    <div className="faq-expandable-body question-body">
                      <div className="q-tags">
                        <span className="tag content-type-badge faq">FAQ</span>
                        {getCategory(faq) && (
                          <span className="tag category">{getCategory(faq)}</span>
                        )}
                        {getTags(faq).slice(0, 3).map((t, i) => (
                          <span key={i} className="tag">
                            #{t}
                          </span>
                        ))}
                      </div>
                      <h3 className="q-title">{faq.title}</h3>
                      {faq.excerpt && (
                        <p className="q-excerpt">{faq.excerpt}…</p>
                      )}
                      <div className="q-footer">
                        <div className="q-meta">
                          <span>👁 {faq.views ?? 0} views</span>
                          <span>▲ {faq.votes ?? 0} votes</span>
                          <span className="time-ago">{timeAgo(faq.updatedAt || faq.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="faq-expandable-chevron" aria-hidden="true">
                      <ChevronRight size={20} />
                    </div>
                  </div>

                  {index !== filteredFAQs.length - 1 && <div className="divider" />}
                </div>
              );
            })}
          </section>
        </main>
      </div>
      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
