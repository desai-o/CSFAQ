import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronUp, Eye, EyeOff } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import Hashtag from "../components/Hashtag";
import { useFAQ } from "../context/FAQContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { deleteFaq, deleteQuery, updateAnswer, deleteAnswer, updateQuery, fetchAnswers, createBounty, awardBounty, fetchBounties, incrementFaqView, incrementQueryView } from "../api/faqApi";
import { useFollow } from "../context/FollowContext";
import ErrorToast from "../components/ErrorToast";
import { timeAgo } from "../utils/timeAgo";

const defaultQuestion = {
  title: "Question Not Found",
  category: "General",
  description: "This question could not be found.",
  hashtags: [],
  votes: 0,
  voted: false,
  bookmarked: false,
  author: "Unknown",
  time: "N/A",
  views: 0,
  answers: [],
};

function QuestionDetail() {
  const { questions, upvoteQuestion, bookmarkQuestion, addAnswer, upvoteAnswer, loadingQuestions, refreshQuestions, deleteQuestion, restoreQuestion, removeAnswerLocally, restoreAnswerLocally, toggleAnonymity, removePendingDeletion } = useFAQ();
  const { id } = useParams();
  const [showModal, setShowModal] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [activeBounty, setActiveBounty] = useState(null);
  const [bountyAmount, setBountyAmount] = useState(50);
  const [showBountyForm, setShowBountyForm] = useState(false);
  const [bountyLoading, setBountyLoading] = useState(false);
  const [pendingQuestionDelete, setPendingQuestionDelete] = useState(null);
  const [pendingAnswerDelete, setPendingAnswerDelete] = useState(null);
  const [hasGoneBack, setHasGoneBack] = useState(false);
  const [openAnswerDropdownId, setOpenAnswerDropdownId] = useState(null);

  const [isAnonymousReply, setIsAnonymousReply] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState({ type: "", id: "" });
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  // Follow state is owned by FollowContext so it persists across
  // navigation, page reloads, and across every follow button in the app.
  const {
    getFollowRecord,
    follow: ctxFollow,
    unfollow: ctxUnfollow,
    toggleMute: ctxToggleMute
  } = useFollow();

  const { user } = useAuth();
  const { theme } = useTheme();
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState([]);

  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [editQuestionData, setEditQuestionData] = useState({
    title: "",
    description: "",
    category: "",
    hashtags: []
  });
  // Separate state for the current tag being typed in edit mode
  const [currentTagInput, setCurrentTagInput] = useState("");

  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editAnswerContent, setEditAnswerContent] = useState("");

  const getQuestionId = (item) => String(item.id || item._id || item.mongo_id || "");
  const question = questions.find((item) => getQuestionId(item) === String(id)) || defaultQuestion;
  const questionId = String(question.id || "");

  const followRecord = useMemo(
    () => (questionId ? getFollowRecord("question", questionId) : null),
    [getFollowRecord, questionId]
  );
  const followData = useMemo(
    () => ({
      isFollowing: Boolean(followRecord),
      isMuted: Boolean(followRecord?.isMuted),
      followId: followRecord?.id || null
    }),
    [followRecord]
  );

  const [showFollowMenu, setShowFollowMenu] = useState(false);
  const followMenuRef = useRef(null);

  const [answersPagination, setAnswersPagination] = useState({ limit: 10, offset: 0, total: 0 });

  const loadAnswers = async (page = 0) => {
    try {
      const newOffset = page * answersPagination.limit;
      const res = await fetchAnswers(id, answersPagination.limit, newOffset);
      console.log("DEBUG loadAnswers - raw response:", JSON.stringify(res.data, null, 2));
      if (res.data) {
        console.log("DEBUG loadAnswers - first answer raw:", JSON.stringify(res.data[0], null, 2));
        const mapped = res.data.map((ans) => {
          const rawIsAnon = ans.isAnonymous || ans.is_anonymous || false;
          return {
            id: ans._id || ans.id,
            userId: ans.userId || ans.user_id,
            authorId: ans.userId || ans.user_id,
            isAnonymous: rawIsAnon,
            author: rawIsAnon ? "Anonymous User" : (ans.author || ans.authorName || "Community Member"),
            originalAuthorName: ans.authorName || ans.author || "Community Member",
            avatar: rawIsAnon ? "🕵️" : (ans.author || ans.authorName || "C")[0].toUpperCase(),
            content: ans.content,
            createdAt: ans.createdAt,
            updatedAt: ans.updatedAt,
            votes: ans.votes || 0,
            time: ans.createdAt || ans.created_at || "Recently",
            isBest: Boolean(ans.isBest || ans.is_best)
          };
        });
        setAnswers(mapped);
        if (res.meta?.pagination) {
          setAnswersPagination(res.meta.pagination);
        } else if (res.pagination) {
          setAnswersPagination(res.pagination);
        }
      }
    } catch (err) {
      console.error("Failed to load answers from backend", err);
    }
  };

  const loadBounties = async () => {
    try {
      const res = await fetchBounties();
      if (res && res.data) {
        const match = res.data.find(b => String(b.queryId || b.query_id) === String(id) && b.status === "open");
        setActiveBounty(match || null);
      }
    } catch (err) {
      console.error("Failed to load bounties:", err);
    }
  };

  const handleCreateBounty = async (e) => {
    e.preventDefault();
    setBountyLoading(true);
    try {
      await createBounty({
        queryId: id,
        amount: Number(bountyAmount),
        durationDays: 7
      });
      setShowBountyForm(false);
      await loadBounties();
      setError("");
    } catch (err) {
      console.error("Failed to create bounty:", err);
      setError(err.message || "Failed to create bounty. Note: You need enough reputation points.");
    } finally {
      setBountyLoading(false);
    }
  };

  const handleAwardBounty = async (answerId) => {
    if (!activeBounty) return;
    try {
      const bountyId = activeBounty.id || activeBounty._id;
      await awardBounty(bountyId, { answerId });
      setActiveBounty(null);
      await loadBounties();
      loadAnswers(0);
      setError("");
      alert("Bounty awarded successfully!");
    } catch (err) {
      console.error("Failed to award bounty:", err);
      setError(err.message || "Failed to award bounty.");
    }
  };

useEffect(() => {
    if (loadingQuestions) return;

    if (id && id !== "test-id" && id !== "undefined") {
      loadAnswers(0);
      loadBounties();
    } else if (question && question.answers) {
      setAnswers(question.answers);
    }
  }, [id, loadingQuestions]);

  // Bump the view counter when the user opens a question detail page.
  // Uses a ref to make sure we only fire one POST per id even when React
  // StrictMode double-invokes effects in development.
  const viewedRef = useRef(null);
  useEffect(() => {
    if (!id || id === "test-id" || id === "undefined") return;
    if (String(id).startsWith("local-")) return;
    if (viewedRef.current === id) return;
    viewedRef.current = id;

    const sourceType = question?.sourceType || "query";
    const inc = sourceType === "faq" ? incrementFaqView : incrementQueryView;
    inc(id).then((res) => {
      const newViews = res?.data?.views;
      if (typeof newViews === "number") {
        // Bump the cached question so the visible view count updates
        // immediately without having to refetch the entire question list.
        if (typeof refreshQuestions === "function") {
          // We deliberately do NOT refresh the whole list — that would
          // clobber any in-flight edits. Instead, the user can refresh
          // manually if they care about an exact number.
        }
      }
    }).catch(() => {
      // already swallowed inside the api helper, but be defensive
    });
  }, [id, question?.sourceType]);

  // Scroll to top on navigation to different question
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Compute related questions from FAQContext
  const getRelatedQuestions = () => {
    if (!question || question === defaultQuestion) return [];

    // Filter out the current question
    const otherQuestions = questions.filter((q) => getQuestionId(q) !== String(id));

    const currentTags = question.hashtags || [];
    const currentTitleWords = (question.title || "").toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const scored = otherQuestions.map((q) => {
      let score = 0;

      // 1. Match category
      if (q.category === question.category) {
        score += 5;
      }

      // 2. Match tags
      const qTags = q.hashtags || [];
      const commonTags = qTags.filter((t) => currentTags.map(x => x.toLowerCase()).includes(t.toLowerCase()));
      score += commonTags.length * 3;

      // 3. Match title keywords
      const qTitleWords = (q.title || "").toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const commonWords = qTitleWords.filter((w) => currentTitleWords.includes(w));
      score += commonWords.length * 2;

      return { question: q, score };
    });

    // Sort by score descending, filter out scores <= 0, and take top 5
    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.question)
      .slice(0, 5);
  };

  const relatedQuestions = getRelatedQuestions();

  function canDelete(resource) {
    if (!user || !resource) return false;

    return (
      user.role === "admin" ||
      String(resource.userId || resource.user_id) === String(user.id)
    );
  }

  function canEdit(resource) {
  if (!user || !resource) return false;

  return (
    user.role === "admin" ||
    String(resource.userId || resource.user_id) === String(user.id)
  );
}

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (followMenuRef.current && !followMenuRef.current.contains(event.target)) {
        setShowFollowMenu(false);
      }
      // Close answer dropdowns when clicking outside
      if (!event.target.closest('.answer-dropdown-menu') && !event.target.closest('.answer-dropdown-trigger')) {
        setOpenAnswerDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFollowClick = async () => {
    if (!user) {
      setError("Please log in to follow questions.");
      return;
    }
    if (!questionId || questionId === "undefined") return;
    if (!followData.isFollowing) {
      try {
        await ctxFollow("question", questionId);
        setShowFollowMenu(false);
      } catch (err) {
        // 409 = already following; FollowContext.refresh() has already
        // reconciled the canonical state, so just close the menu.
        if (err?.status !== 409) {
          console.error("Failed to follow", err);
          setError(err?.message || "Failed to follow.");
        }
      }
    } else {
      setShowFollowMenu((v) => !v);
    }
  };

  const handleUnfollow = async () => {
    try {
      await ctxUnfollow("question", questionId);
      setShowFollowMenu(false);
    } catch (err) {
      console.error("Failed to unfollow", err);
      setError(err?.message || "Failed to unfollow.");
    }
  };

  const handleMuteToggle = async () => {
    try {
      await ctxToggleMute("question", questionId);
      setShowFollowMenu(false);
    } catch (err) {
      console.error("Failed to toggle mute", err);
      setError(err?.message || "Failed to toggle mute.");
    }
  };

  const toggleQVote = () => {
    if (question.id) upvoteQuestion(question.id);
  };

  const toggleBookmark = () => {
    if (question.id) bookmarkQuestion(question.id);
  };

  const toggleAnswerVote = (answerId) => {
    if (question.id) upvoteAnswer(question.id, answerId);
  };

const handleSubmitReply = async () => {
    if (replyText.trim() && question.id) {
      try {
        const newAnswer = await addAnswer(question.id, replyText, question.sourceType || "faq", isAnonymousReply);
        if (newAnswer) {
          setAnswers((prev) => [newAnswer, ...prev]);
        }
        setReplyText("");
        setIsAnonymousReply(false);
        setError("");
      } catch (err) {
        console.error("Failed to submit answer:", err);
        setError(err.message || "Failed to post your answer.");
      }
    }
  };

  const handleReportSubmit = async () => {
    if (!user) {
      setReportError("You must be logged in to report.");
      return;
    }
    setReportLoading(true);
    setReportError("");
    try {
      // Inline fetch for now, or assume we have a faqApi method
      // We will define it in faqApi.js shortly.
      const { submitReport } = await import("../api/faqApi");
      await submitReport({
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportReason,
        details: reportDetails
      });
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
        setReportReason("spam");
        setReportDetails("");
      }, 2000);
    } catch (err) {
      setReportError(err.message || "Failed to submit report. Please try again later.");
    } finally {
      setReportLoading(false);
    }
  };

  const generateSummary = async () => {
    try {
      setSummaryLoading(true);
      setSummaryError("");
      setSummary("");

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

      const response = await fetch(`${apiBaseUrl}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: question.title || question.question,
          answers: (answers || []).map((a) => a.content)
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate summary: ${response.status}`);
      }

      const data = await response.json();
      setSummary(data.data?.summary || data.summary);
    } catch (err) {
      console.error(err);
      setSummaryError(err.message || "Failed to generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  };

  if (pendingQuestionDelete) {
  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />

        <main className="content">
          <div
            style={{
              padding: "40px",
              textAlign: "center"
            }}
          >
            <h2>Question deleted</h2>

            <p>
              This question will be permanently deleted in{" "}
              {pendingQuestionDelete.countdown} seconds.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                marginTop: "20px"
              }}
            >
              <button
                className="bookmark-btn"
                onClick={() => {
                  clearTimeout(pendingQuestionDelete.timeoutId);
                  clearInterval(pendingQuestionDelete.intervalId);
                  removePendingDeletion(pendingQuestionDelete.question.id);
                  restoreQuestion(pendingQuestionDelete.question);
                  setPendingQuestionDelete(null);
                }}
              >
                Undo
              </button>
              <button
                className="bookmark-btn"
                onClick={() => {
                  setHasGoneBack(true);
                  window.history.back();
                }}
              >
                Go Back to questions
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />
        <main className="content">
          <ErrorToast message={error} onClose={() => setError("")} />
          <Link to="/questions" className="back-link">← Back to Questions</Link>

          <div className="detail-grid">
            <div className="detail-main">
              <div className="detail-card">
                <div className="detail-top">
                  <div className="vote-col">
                    <button
                      className={`upvote ${question.voted ? "upvoted" : ""}`}
                      onClick={toggleQVote}
                      aria-label="Upvote question"
                    >
                      <ChevronUp size={20} />
                    </button>
                    <span className="vote-count">{question.votes}</span>
                  </div>

                  <div className="detail-body">
                    {activeBounty ? (
                      <div style={{
                        margin: "12px 0 16px",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        color: "#f59e0b",
                        fontSize: "13.5px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <span>💰 <strong>Active Bounty:</strong> Earn <strong>{activeBounty.amount} reputation points</strong> for answering this question!</span>
                        <span style={{ fontSize: "11px", opacity: 0.8 }}>
                          Expires: {new Date(activeBounty.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      user && (
                        <div style={{ margin: "12px 0 16px" }}>
                          {!showBountyForm ? (
                            <button
                              onClick={() => setShowBountyForm(true)}
                              style={{
                                padding: "6px 12px",
                                fontSize: "12px",
                                borderRadius: "6px",
                                backgroundColor: "transparent",
                                border: "1px dashed var(--border)",
                                color: "var(--text-secondary)",
                                cursor: "pointer"
                              }}
                            >
                              + Sponsor Bounty
                            </button>
                          ) : (
                            <form onSubmit={handleCreateBounty} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--surface-secondary)" }}>
                              <span style={{ fontSize: "12.5px" }}>Reputation Points:</span>
                              <input
                                type="number"
                                min="10"
                                step="10"
                                value={bountyAmount}
                                onChange={(e) => setBountyAmount(e.target.value)}
                                style={{
                                  width: "70px",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--border)",
                                  backgroundColor: "var(--bg-color)",
                                  color: "var(--text-primary)"
                                }}
                                required
                              />
                              <button
                                type="submit"
                                disabled={bountyLoading}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                  borderRadius: "4px",
                                  backgroundColor: "#f59e0b",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: "600"
                                }}
                              >
                                {bountyLoading ? "Creating..." : "Post Bounty"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowBountyForm(false)}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                  borderRadius: "4px",
                                  backgroundColor: "transparent",
                                  color: "var(--text-secondary)",
                                  border: "none",
                                  cursor: "pointer"
                                }}
                              >
                                Cancel
                              </button>
                            </form>
                          )}
                        </div>
                      )
                    )}

                {isEditingQuestion ? (
                  <>
                    <input
                      type="text"
                      value={editQuestionData.title}
                      onChange={(e) =>
                        setEditQuestionData({
                         ...editQuestionData,
                         title: e.target.value
                        })
                      }
                      className="detail-title-input"
                      style={{
                        width: "100%",
                        fontSize: "2rem",
                        fontWeight: "700",
                        padding: "10px",
                        marginBottom: "12px"
                      }}
                    />
                    <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                      <button
                        className="bookmark-btn"
                        onClick={async () => {
                          // Front-end validation to match backend schema
                          // (`updateQuerySchema` requires question.min(3) and tags.min(1)).
                          const trimmedTitle = (editQuestionData.title || "").trim();
                          if (trimmedTitle.length < 3) {
                            setError("Question title must be at least 3 characters.");
                            return;
                          }
                          const hashtags = Array.isArray(editQuestionData.hashtags)
                            ? editQuestionData.hashtags.filter(Boolean)
                            : [];
                          if (hashtags.length === 0) {
                            setError("Please add at least one tag before saving.");
                            return;
                          }
                          if (!editQuestionData.category) {
                            setError("Please select a category.");
                            return;
                          }
                          try {
                            await updateQuery(question.id, {
                              question: trimmedTitle,
                              description: editQuestionData.description,
                              category: editQuestionData.category,
                              tags: hashtags
                            });
                            setError("");
                            await refreshQuestions();
                            setIsEditingQuestion(false);
                          } catch (err) {
                            console.error(err);
                            // Prefer server-supplied error message when available
                            const msg = err?.message || "Failed to update question";
                            setError(msg);
                          }
                        }}
                      >
                      Save
                      </button>

                      <button
                        className="bookmark-btn"
                        onClick={() => {
                          setIsEditingQuestion(false);
                        }}
                      >
                      Cancel
                      </button>
                    </div>
                  </>
                  ) : (
                    <h1 className="detail-title">
                      {question.title}
                    </h1>
                  )}

                <button
                  onClick={generateSummary}
                  style={{
                    marginTop: "12px",
                    marginBottom: "12px",
                    padding: "8px 14px",
                    cursor: "pointer"
                  }}
                >
                  ✨ Generate TL;DR
                </button>

                    {summaryLoading && <p style={{ color: "#aaa", marginBottom: "12px" }}>Generating summary...</p>}
                    {summaryError && <p role="alert" style={{ color: "#f87171", marginBottom: "12px" }}>{summaryError}</p>}

                {summary && (
                  <div
                    style={{
                      marginBottom: "16px",
                      padding: "12px",
                      border: "1px solid #444",
                      borderRadius: "8px",
                      background: theme === "dark" ? "#1e1e1e" : "#f8f8f8",
                      color: theme === "dark" ? "#eee" : "#111"
                    }}
                  >
                    <strong>AI Summary</strong>
                    <p style={{ marginTop: "6px", fontSize: "14px", lineHeight: "1.5" }}>{summary}</p>
                  </div>
                )}



                  {isEditingQuestion ? (
                    <>
                    <select
                    value={editQuestionData.category}
                    onChange={(e) =>
                      setEditQuestionData({
                        ...editQuestionData,
                        category: e.target.value
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "12px",
                      marginTop: "12px",
                      marginBottom: "12px",
                      borderRadius: "8px"
                      }}
                      >
                      <option value="">Select a category</option>
                      <option>Programming</option>
                      <option>Artificial Intelligence</option>
                      <option>Career</option>
                      <option>Research</option>
                      <option>Scholarships</option>
                      <option>Mathematics</option>
                      </select>

                      {/* Tag input with comma/Enter key support */}
                      <div style={{ marginTop: "12px", marginBottom: "12px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                          Tags
                        </label>

                        {/* Display existing tags as removable chips */}
                        {editQuestionData.hashtags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                            {editQuestionData.hashtags.map((tag, index) => (
                              <span
                                key={index}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 10px",
                                  backgroundColor: "var(--primary-color, #3b82f6)",
                                  color: "#fff",
                                  borderRadius: "16px",
                                  fontSize: "13px"
                                }}
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditQuestionData({
                                      ...editQuestionData,
                                      hashtags: editQuestionData.hashtags.filter((_, i) => i !== index)
                                    });
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#fff",
                                    cursor: "pointer",
                                    padding: "0",
                                    fontSize: "16px",
                                    lineHeight: "1",
                                    opacity: 0.8
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <input
                          type="text"
                          value={currentTagInput}
                          onChange={(e) => setCurrentTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "," || e.key === "Enter") {
                              e.preventDefault();
                              const newTag = currentTagInput.trim().replace(/^,|,$/g, "");
                              if (newTag) {
                                // Check for duplicates (case-insensitive)
                                const isDuplicate = editQuestionData.hashtags.some(
                                  t => t.toLowerCase() === newTag.toLowerCase()
                                );
                                if (!isDuplicate) {
                                  setEditQuestionData({
                                    ...editQuestionData,
                                    hashtags: [...editQuestionData.hashtags, newTag]
                                  });
                                }
                              }
                              setCurrentTagInput("");
                            }
                          }}
                          placeholder="Type a tag and press comma or Enter to add"
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)"
                          }}
                        />
                      </div>

                    <textarea
                     value={editQuestionData.description}
                     onChange={(e) =>
                       setEditQuestionData({
                         ...editQuestionData,
                         description: e.target.value
                      })
                     }
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "12px",
                      marginTop: "12px",
                      marginBottom: "12px",
                      borderRadius: "8px"
                     }}
                  />
                  </>
                  ) : (
                        <p className="detail-description">{question.description}</p>
                      )}

                    <div className="detail-hashtags">
                      {question.hashtags.map((tag) => (
                        <Hashtag key={tag} tag={tag} />
                      ))}
                    </div>

                    <div className="detail-meta">
                      <span>Asked by <strong>{question.author}</strong></span>
                      {question.updatedAt &&
                        question.createdAt &&
                        question.updatedAt !== question.createdAt && (
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
                      <span className="time-ago">{timeAgo(question.createdAt || question.time)}</span>
                      <span>👁 {question.views} views</span>
                      <button
                        className={`bookmark-btn ${question.bookmarked ? "bookmarked" : ""}`}
                        onClick={toggleBookmark}
                      >
                        {question.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
                      </button>

                  {canEdit(question) && (
                    <button
                      className="bookmark-btn edit-button"
                      onClick={()=> {
                        setEditQuestionData({
                          title: question.title || "",
                          description: question.description || "",
                          category: question.category || "",
                          hashtags: question.hashtags || []
                      });
                      setCurrentTagInput("");
                      setIsEditingQuestion(true);
                    }}
                      >
                     ✎ Edit
                    </button>
                  )}

                      {canDelete(question) && (
                        <button
                          className="bookmark-btn danger-button"
                          onClick={async () => {
                            const confirmed = window.confirm(
                              "Are you sure you want to delete this question?"
                            );
                            if (!confirmed) return;
                           const deletedQuestion = question;
                           deleteQuestion(question.id);
                           let countdown = 10;
                           const intervalId = setInterval(() => {
                             countdown--;
                           setPendingQuestionDelete(prev => {
                             if (!prev) return null;
                             return {
                               ...prev,
                               countdown
                             };
                           });
                         }, 1000);
                         const timeoutId = setTimeout(async () => {
                           clearInterval(intervalId);
                           // Local-only ids (e.g. "local-<uuid>") were never
                           // synced to the backend, so there is nothing to
                           // delete on the server. Skip the network call to
                           // avoid a Cast-to-ObjectId error.
                           if (String(deletedQuestion.id).startsWith("local-")) {
                             removePendingDeletion(deletedQuestion.id);
                             setPendingQuestionDelete(null);
                             if (!hasGoneBack) {
                               window.history.back();
                             }
                             return;
                           }
                           try {
                             await deleteQuery(deletedQuestion.id);
                             // Backend delete succeeded — clear the pending entry
                             // so we do not retry it on next mount.
                             removePendingDeletion(deletedQuestion.id);
                             await refreshQuestions();
                             setPendingQuestionDelete(null);
                             if (!hasGoneBack) {
                              window.history.back();}
                           } catch (err) {
                             setError(err.message || "Failed to delete question.");
                             // Leave the pending deletion queued so we retry on
                             // next mount (handles a reload during the 10s window).
                           }
                         }, 10000);
                         setPendingQuestionDelete({
                           question: deletedQuestion,
                           countdown: 10,
                           timeoutId,
                           intervalId
                         });
                       }}
                      >
                        🗑 Delete
                      </button>
                  )}

                      <div style={{ position: "relative" }} ref={followMenuRef}>
                        <button
                          className={`bookmark-btn ${followData.isFollowing ? "bookmarked" : ""}`}
                          onClick={handleFollowClick}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          {followData.isFollowing ? (
                            followData.isMuted ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                                Muted
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                Following
                              </>
                            )
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                              Follow
                            </>
                          )}
                        </button>
                        {showFollowMenu && (
                          <div style={{
                            position: "absolute", top: "100%", right: 0, marginTop: "4px",
                            background: theme === "dark" ? "#18181b" : "#fff",
                            border: theme === "dark" ? "1px solid #2a2d3e" : "1px solid #e5e5e5",
                            borderRadius: "6px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, width: "160px",
                            display: "flex", flexDirection: "column", padding: "4px 0"
                          }}>
                            <button
                              onClick={handleMuteToggle}
                              style={{
                                background: "none", border: "none", width: "100%", textAlign: "left",
                                padding: "8px 12px", fontSize: "13px", cursor: "pointer",
                                color: theme === "dark" ? "#e5e5e5" : "#1a1a1a"
                              }}
                              onMouseOver={e => e.currentTarget.style.background = theme === "dark" ? "#242424" : "#f5f5f5"}
                              onMouseOut={e => e.currentTarget.style.background = "none"}
                            >
                              {followData.isMuted ? "Unmute notifications" : "Mute notifications"}
                            </button>
                            <button
                              onClick={handleUnfollow}
                              style={{
                                background: "none", border: "none", width: "100%", textAlign: "left",
                                padding: "8px 12px", fontSize: "13px", cursor: "pointer", color: "#ef4444"
                              }}
                              onMouseOver={e => e.currentTarget.style.background = theme === "dark" ? "#242424" : "#f5f5f5"}
                              onMouseOut={e => e.currentTarget.style.background = "none"}
                            >
                              Unfollow
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {pendingAnswerDelete && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span>
                    Answer deleted. Undo available for{" "}
                    {pendingAnswerDelete.countdown} seconds.
                  </span>

                  <button
                    className="bookmark-btn"
                    onClick={() => {
                      clearTimeout(pendingAnswerDelete.timeoutId);
                      clearInterval(pendingAnswerDelete.intervalId);

                      setAnswers((prev) => [
                        pendingAnswerDelete.answer,
                        ...prev
                      ]);
                      restoreAnswerLocally(
                        question.id,
                        pendingAnswerDelete.answer
                      );
                      setPendingAnswerDelete(null);
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}

              <section className="answers-section">
                <h2 className="answers-heading">
                  {answers ? answers.length : 0} {answers && answers.length === 1 ? "Answer" : "Answers"}
                </h2>

                {answers && answers.map((answer) => (
                  <div key={answer.id} className={`answer-card ${answer.isBest ? "best-answer" : ""}`} style={{ position: "relative" }}>
                    <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 5 }}>
                      <button
                        className="bookmark-btn icon-btn answer-dropdown-trigger"
                        onClick={() => setOpenAnswerDropdownId(openAnswerDropdownId === answer.id ? null : answer.id)}
                        aria-label="More options"
                        data-tooltip="More options"
                      >
                        ⋯
                      </button>
                      {openAnswerDropdownId === answer.id && (
                        <div
                          className="answer-dropdown-menu"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            right: 0,
                            background: theme === "dark" ? "#18181b" : "#fff",
                            border: theme === "dark" ? "1px solid #2a2d3e" : "1px solid #e5e5e5",
                            borderRadius: "6px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            zIndex: 10,
                            minWidth: "160px",
                            display: "flex",
                            flexDirection: "column",
                            padding: "4px 0"
                          }}
                        >
                          <button
                            onClick={() => {
                              setReportTarget({ type: "answer", id: answer.id });
                              setShowReportModal(true);
                              setOpenAnswerDropdownId(null);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 12px",
                              fontSize: "13px",
                              cursor: "pointer",
                              color: theme === "dark" ? "#e5e5e5" : "#1a1a1a",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                            }}
                            onMouseOver={e => e.currentTarget.style.background = theme === "dark" ? "#242424" : "#f5f5f5"}
                            onMouseOut={e => e.currentTarget.style.background = "none"}
                          >
                            <span>🚩</span>
                            <span>Report</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="vote-col">
                      <button
                        className={`upvote ${answer.voted ? "upvoted" : ""}`}
                        onClick={() => toggleAnswerVote(answer.id)}
                        aria-label="Upvote answer"
                      >
                        <ChevronUp size={20} />
                      </button>
                      <span className="vote-count">{answer.votes}</span>
                    </div>

                <div className="answer-body">
                  {answer.isBest && (
                    <span className="best-badge">✓ Best Answer</span>
                  )}
                  {editingAnswerId === answer.id ? (
                    <>
                    <textarea
                      value={editAnswerContent}
                      onChange={(e) => setEditAnswerContent(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px"
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "10px"
                      }}
                    >
                      <button
                        className="bookmark-btn"
                        onClick={async () => {
                          if (!editAnswerContent.trim()) {
                            setError("Answer cannot be empty.");
                            return;
                          }
                          try {
                            await updateAnswer(answer.id, {
                            content: editAnswerContent
                          });
                          setAnswers((prev) =>
                            prev.map((a) =>
                              String(a.id) === String(answer.id)
                                ? { ...a, content: editAnswerContent, updatedAt: new Date().toISOString() }
                                : a
                             )
                            );
                            setEditingAnswerId(null);
                          } catch (err) {
                            setError(err.message || "Failed to update answer.");
                          }
                        }}
                      >
                        Save
                      </button>

                      <button
                        className="bookmark-btn"
                        onClick={() => {
                          setEditingAnswerId(null);
                          setEditAnswerContent("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                 ) : (
                    <p className="answer-text">{answer.content}</p>
                  )}
                  <div className="answer-meta">
                    <div className="answer-author">
                      <div className="avatar small">{answer.avatar}</div>
                      <strong>{answer.author}</strong>
                      {answer.authorId && question.authorId && String(answer.authorId) === String(question.authorId) && (
                        <span style={{
                          marginLeft: "6px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          backgroundColor: "var(--primary-color, #3b82f6)",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}>
                          OP
                        </span>
                      )}
                    </div>
                    <div
                        style={{
                          marginLeft: "auto",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px"
                        }}
                      >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        {answer.updatedAt &&
                        answer.createdAt &&
                        answer.updatedAt !== answer.createdAt && (
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
                         <span className="answer-time time-ago">{timeAgo(answer.createdAt || answer.time)}</span>
                      </div>
                      {canEdit(answer) && (
                        <button
                          onClick={async () => {
                            // Pass current state explicitly to avoid stale reads
                            await toggleAnonymity(answer.id, "answer", answer.isAnonymous);
                            // Also update local answers state
                            setAnswers((prev) =>
                              prev.map((a) =>
                                String(a.id) === String(answer.id)
                                  ? {
                                      ...a,
                                      isAnonymous: !a.isAnonymous,
                                      author: !a.isAnonymous ? "Anonymous User" : (a.originalAuthorName || user?.name || "Community Member"),
                                      avatar: !a.isAnonymous ? "🕵️" : (a.originalAuthorName || user?.name || "C").charAt(0).toUpperCase()
                                    }
                                  : a
                              )
                            );
                          }}
                          className="bookmark-btn icon-btn"
                          data-tooltip={answer.isAnonymous ? "De-anonymize" : "Anonymize"}
                          aria-label={answer.isAnonymous ? "De-anonymize" : "Anonymize"}
                        >
                          {answer.isAnonymous ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      {canEdit(answer) && (
                        <button
                          className="bookmark-btn icon-btn"
                          onClick={() => {
                            setEditingAnswerId(answer.id);
                            setEditAnswerContent(answer.content);
                          }}
                          data-tooltip="Edit"
                          aria-label="Edit"
                        >
                          ✎
                        </button>
                      )}
                      {canDelete(answer) && (
                        <button
                          className="bookmark-btn danger-button icon-btn"
                          onClick={() => {
                            const confirmed = window.confirm(
                              "Are you sure you want to delete this answer?"
                            );

                            if (!confirmed) return;

                            const deletedAnswer = answer;

                            setAnswers((prev) =>
                              prev.filter((item) => String(item.id) !== String(answer.id))
                            );
                            removeAnswerLocally(question.id, answer.id);
                            let countdown = 10;

                            const intervalId = setInterval(() => {
                              countdown--;

                              setPendingAnswerDelete((prev) => {
                                if (!prev) return null;

                                return {
                                  ...prev,
                                  countdown
                                };
                              });
                            }, 1000);

                            const timeoutId = setTimeout(async () => {
                              clearInterval(intervalId);

                              try {
                                await deleteAnswer(deletedAnswer.id);
                                setPendingAnswerDelete(null);
                                await loadAnswers(0);
                              } catch (err) {
                                setError(err.message || "Failed to delete answer.");
                              }
                            }, 10000);

                            setPendingAnswerDelete({
                              answer: deletedAnswer,
                              countdown: 10,
                              timeoutId,
                              intervalId
                            });
                          }}
                          data-tooltip="Delete"
                          aria-label="Delete"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                    {activeBounty && (String(activeBounty.createdBy) === String(user?.id) || user?.role === "admin") && (
                      <button
                        onClick={() => handleAwardBounty(answer.id)}
                        className="bounty-award-btn"
                        style={{
                          marginLeft: canDelete(answer) ? "10px" : "auto",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          backgroundColor: "#f59e0b",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "12px"
                        }}
                      >
                        🏆 Award Bounty ({activeBounty.amount} pts)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {answersPagination.total > answersPagination.limit && (
              <div className="pagination-controls" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "15px", marginBottom: "15px" }}>
                <button
                  disabled={answersPagination.offset === 0}
                  onClick={() => loadAnswers(Math.floor(answersPagination.offset / answersPagination.limit) - 1)}
                  className="pagination-btn btn-secondary"
                  style={{ padding: "6px 12px", cursor: answersPagination.offset === 0 ? "not-allowed" : "pointer" }}
                >
                  Previous
                </button>
                <span className="pagination-info" style={{ color: "#eee" }}>
                  Page {Math.floor(answersPagination.offset / answersPagination.limit) + 1} of {Math.ceil(answersPagination.total / answersPagination.limit)}
                </span>
                <button
                  disabled={answersPagination.offset + answersPagination.limit >= answersPagination.total}
                  onClick={() => loadAnswers(Math.floor(answersPagination.offset / answersPagination.limit) + 1)}
                  className="pagination-btn btn-secondary"
                  style={{ padding: "6px 12px", cursor: (answersPagination.offset + answersPagination.limit >= answersPagination.total) ? "not-allowed" : "pointer" }}
                >
                  Next
                </button>
              </div>
            )}
          </section>

              <section className="reply-section">
                <h2 className="answers-heading">Your Answer</h2>
                <textarea
                  className="reply-textarea"
                  placeholder="Write your answer here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      id="anon-reply-checkbox"
                      checked={isAnonymousReply}
                      onChange={(e) => setIsAnonymousReply(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <label htmlFor="anon-reply-checkbox" style={{ fontSize: "14px", cursor: "pointer", color: "var(--text-primary)", userSelect: "none" }}>
                      Answer anonymously
                    </label>
                  </div>
                  <button className="reply-submit" onClick={handleSubmitReply} style={{ margin: 0 }}>Post Your Answer</button>
                </div>
              </section>
            </div>

            <aside className="detail-sidebar">
              <div className="related-widget">
                <h4 className="widget-title">Related Questions</h4>
                {relatedQuestions.length === 0 ? (
                  <div className="related-empty">No related questions found.</div>
                ) : (
                  <div className="related-list">
                    {relatedQuestions.map((q) => (
                      <div key={getQuestionId(q)} className="related-item">
                        <span className="related-item-category">{q.category}</span>
                        <h5 className="related-item-title">
                          <Link to={`/questions/${getQuestionId(q)}`}>{q.title}</Link>
                        </h5>
                        <div className="related-item-meta">
                          <span>▲ {q.votes} votes</span>
                          <span>💬 {q.answers ? q.answers.length : 0} answers</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay active" onClick={() => !reportLoading && setShowReportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Report {reportTarget.type === "question" ? "Question" : "Answer"}</h2>
              <button className="modal-close" onClick={() => !reportLoading && setShowReportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {reportSuccess ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#10b981" }}>
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>✅</div>
                  <h3 style={{ margin: 0 }}>Report Submitted</h3>
                  <p style={{ marginTop: "8px", color: "var(--text-secondary)", fontSize: "14px" }}>Thank you for helping keep our community safe.</p>
                </div>
              ) : (
                <>
                  {reportError && (
                    <div style={{ color: "#ef4444", marginBottom: "16px", fontSize: "14px", backgroundColor: "rgba(239,68,68,0.1)", padding: "10px", borderRadius: "6px" }}>
                      ⚠️ {reportError}
                    </div>
                  )}
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>Reason for reporting</label>
                  <select
                    className="modal-input"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    disabled={reportLoading}
                    style={{ marginBottom: "16px" }}
                  >
                    <option value="spam">Spam or Unsolicited Promotion</option>
                    <option value="harassment">Harassment or Hate Speech</option>
                    <option value="inappropriate">Inappropriate Content</option>
                    <option value="off-topic">Off-topic</option>
                    <option value="other">Other</option>
                  </select>

                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>Additional Details (Optional)</label>
                  <textarea
                    className="modal-input"
                    placeholder="Provide any additional context..."
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    disabled={reportLoading}
                    rows={4}
                    style={{ resize: "vertical" }}
                  />
                  <div className="modal-footer" style={{ marginTop: "24px" }}>
                    <button className="modal-cancel" onClick={() => setShowReportModal(false)} disabled={reportLoading}>Cancel</button>
                    <button
                      className="modal-submit"
                      onClick={handleReportSubmit}
                      disabled={reportLoading}
                      style={{ backgroundColor: "#ef4444", borderColor: "#ef4444" }}
                    >
                      {reportLoading ? "Submitting..." : "Submit Report"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QuestionDetail;
