import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronUp } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import Hashtag from "../components/Hashtag";
import { useFAQ } from "../context/FAQContext";
import { useTheme } from "../context/ThemeContext";
import { fetchFaqById, incrementFaqView } from "../api/faqApi";
import ErrorToast from "../components/ErrorToast";
import { timeAgo } from "../utils/timeAgo";

const CATEGORY_LABELS = {
  programming: "Programming",
  ai: "Artificial Intelligence",
  career: "Career",
  research: "Research",
  scholarships: "Scholarships",
  mathematics: "Mathematics"
};

function normalizeCategory(raw) {
  if (!raw) return "General";
  const lowered = String(raw).toLowerCase();
  if (CATEGORY_LABELS[lowered]) return CATEGORY_LABELS[lowered];
  return String(raw);
}

function FAQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const {
    questions,
    upvoteQuestion,
    bookmarkQuestion
  } = useFAQ();

  const [showModal, setShowModal] = useState(false);
  const [faq, setFaq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Try to find this FAQ in context first for instant render + live vote state
  const localFaq = questions.find((q) => {
    const qid = String(q.id || q._id || q.mongo_id || "");
    return q.sourceType === "faq" && qid === String(id);
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchFaqById(id);
        if (cancelled) return;
        const data = res?.data || res;
        if (!data) throw new Error("FAQ not found");
        setFaq(normalize(data));
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load FAQ.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => { cancelled = true; };
  }, [id]);

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Bump the view counter when the user opens an FAQ detail page.
  // Uses a ref to ensure we only fire one POST per id, even when React
  // StrictMode double-invokes effects in development.
  const viewedRef = useRef(null);
  useEffect(() => {
    if (!id) return;
    if (String(id).startsWith("local-")) return;
    if (viewedRef.current === id) return;
    viewedRef.current = id;

    incrementFaqView(id).then((res) => {
      const newViews = res?.data?.views;
      if (typeof newViews === "number") {
        setFaq((prev) => (prev ? { ...prev, views: newViews } : prev));
      }
    }).catch(() => {
      // Swallow errors — view tracking is best-effort.
    });
  }, [id]);

  // Merge server data with local context (for live votes/bookmark)
  const merged = (() => {
    if (!faq) return localFaq;
    if (!localFaq) return faq;
    return {
      ...faq,
      voted: localFaq.voted ?? faq.voted,
      votes: localFaq.votes ?? faq.votes,
      bookmarked: localFaq.bookmarked ?? faq.bookmarked
    };
  })();

  function normalize(data) {
    const tagsArr = Array.isArray(data.tags)
      ? data.tags
      : typeof data.tags === "string"
        ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
    return {
      id: data.id || data._id || data.mongo_id || id,
      title: data.question || data.title || "Untitled FAQ",
      description: data.answer || data.description || "",
      category: normalizeCategory(data.category),
      hashtags: tagsArr,
      tags: tagsArr,
      keywords: data.keywords || [],
      votes: data.votes ?? data.voteCount ?? 0,
      voted: false,
      bookmarked: false,
      views: data.views ?? 0,
      createdAt: data.createdAt || data.created_at,
      updatedAt: data.updatedAt || data.updated_at,
      time: data.createdAt || data.created_at || "Recently",
      sourceType: "faq"
    };
  }

  // Related community discussions: same category or overlapping tags
  const relatedDiscussions = (() => {
    if (!merged) return [];
    const otherQuestions = questions.filter((q) => {
      const qid = String(q.id || q._id || q.mongo_id || "");
      return q.sourceType !== "faq" && qid !== String(id);
    });

    const currentTags = (merged.hashtags || merged.tags || []).map((t) => String(t).toLowerCase());

    const scored = otherQuestions.map((q) => {
      let score = 0;
      if (q.category === merged.category) score += 5;
      const qTags = (q.hashtags || []).map((t) => String(t).toLowerCase());
      score += qTags.filter((t) => currentTags.includes(t)).length * 3;
      return { question: q, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.question);
  })();

  const handleUpvote = () => {
    if (merged?.id) upvoteQuestion(merged.id);
  };

  const handleBookmark = () => {
    if (merged?.id) bookmarkQuestion(merged.id);
  };

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />
        <main className="content">
          <ErrorToast message={error} onClose={() => setError("")} />
          <Link to="/faqs" className="back-link">← Back to FAQs</Link>

          {loading && !merged ? (
            <div className="loading-state" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
              <p>Loading FAQ…</p>
            </div>
          ) : !merged ? (
            <div className="empty-state" style={{ padding: "40px", textAlign: "center" }}>
              <span className="empty-icon" style={{ fontSize: "48px" }}>🔍</span>
              <h3>FAQ not found</h3>
              <p>This FAQ may have been removed or is no longer available.</p>
              <button className="bookmark-btn" onClick={() => navigate("/faqs")}>
                Back to FAQs
              </button>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="detail-main">
                <div className="detail-card">
                  <div className="detail-top">
                    <div className="vote-col">
                      <button
                        className={`upvote ${merged.voted ? "upvoted" : ""}`}
                        onClick={handleUpvote}
                        aria-label="Upvote FAQ"
                      >
                        <ChevronUp size={20} />
                      </button>
                      <span className="vote-count">{merged.votes}</span>
                    </div>

                    <div className="detail-body">
                      <div className="q-tags" style={{ marginBottom: "10px" }}>
                        <span className="tag category">{merged.category}</span>
                        <span className="tag content-type-badge">FAQ</span>
                      </div>

                      <h1 className="detail-title">{merged.title}</h1>

                      <div
                        className="detail-description faq-answer-content"
                        dangerouslySetInnerHTML={{ __html: merged.description }}
                        style={{
                          whiteSpace: "pre-wrap",
                          lineHeight: "1.65",
                          padding: theme === "dark" ? "16px" : "14px",
                          borderRadius: "8px",
                          background: theme === "dark" ? "rgba(255,255,255,0.03)" : "var(--surface-secondary, #f5f7fa)",
                          border: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--border, #e5e7eb)",
                          marginTop: "12px",
                          marginBottom: "16px"
                        }}
                      />

                      {merged.hashtags && merged.hashtags.length > 0 && (
                        <div className="detail-hashtags">
                          {merged.hashtags.map((tag) => (
                            <Hashtag key={tag} tag={tag} />
                          ))}
                        </div>
                      )}

                      <div className="detail-meta">
                        <span className="faq-meta-source">Community trusted · AI curated</span>
                        {merged.updatedAt &&
                          merged.createdAt &&
                          merged.updatedAt !== merged.createdAt && (
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#888",
                                fontStyle: "italic"
                              }}
                            >
                              Edited
                            </span>
                          )}
                        <span className="time-ago">{timeAgo(merged.createdAt || merged.time)}</span>
                        <span>👁 {merged.views} views</span>
                        <button
                          className={`bookmark-btn ${merged.bookmarked ? "bookmarked" : ""}`}
                          onClick={handleBookmark}
                        >
                          {merged.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {relatedDiscussions.length > 0 && (
                  <section className="answers-section">
                    <h2 className="answers-heading">💬 Related Community Discussions</h2>
                    <div className="related-discussions-list">
                      {relatedDiscussions.map((q) => {
                        const qid = String(q.id || q._id || q.mongo_id || "");
                        return (
                          <div
                            key={qid}
                            className="related-discussion-card"
                            onClick={() => navigate(`/questions/${qid}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(`/questions/${qid}`);
                              }
                            }}
                          >
                            <div className="vote-col">
                              <button
                                className={`upvote ${q.voted ? "upvoted" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  upvoteQuestion(qid);
                                }}
                                aria-label="Upvote question"
                              >
                                <ChevronUp size={20} />
                              </button>
                              <span className="vote-count">{q.votes || 0}</span>
                            </div>
                            <div className="related-discussion-body">
                              <div className="q-tags">
                                <span className="tag category">{q.category}</span>
                                <span className="tag content-type-badge">Question</span>
                              </div>
                              <h3 className="related-discussion-title">{q.title}</h3>
                              <p className="related-discussion-excerpt">{q.excerpt || ""}</p>
                              <div className="q-footer">
                                <div className="q-hashtags">
                                  {(q.hashtags || []).slice(0, 5).map((tag) => (
                                    <Hashtag key={tag} tag={tag} />
                                  ))}
                                </div>
                                <div className="q-meta">
                                  👤 {q.author || "Community"} &nbsp; 💬 {q.answers ? q.answers.length : 0} answers &nbsp; <span className="time-ago">{timeAgo(q.createdAt || q.time)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

export default FAQDetail;