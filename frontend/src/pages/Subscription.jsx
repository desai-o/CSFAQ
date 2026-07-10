import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import { useFAQ } from "../context/FAQContext";
import { fetchFollowedFeed } from "../api/faqApi";
import Hashtag from "../components/Hashtag";

function Subscription() {
  const { user } = useAuth();
  const { follows, followedTags, followedQuestionIds, unfollow, toggleMute, refresh, loaded, loading } = useFollow();
  const { questions } = useFAQ();

  // Build a lookup from question id -> question so we can show the question's
  // title (rather than its raw id) in the "Followed Questions" section.
  const questionById = useMemo(() => {
    const map = new Map();
    for (const q of questions || []) {
      if (!q) continue;
      const id = String(q.id || q._id || "");
      if (id && !map.has(id)) {
        map.set(id, q);
      }
    }
    return map;
  }, [questions]);

  const [feed, setFeed] = useState({ tags: [], questionIds: [], items: [] });
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setFeedLoading(true);
    setFeedError("");
    fetchFollowedFeed()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || { tags: [], questionIds: [], items: [] };
        setFeed(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("fetchFollowedFeed failed", err);
        setFeedError(err?.message || "Failed to load your feed.");
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, follows, refresh]);

  const onUnfollowTag = async (tagId) => {
    try {
      await unfollow("tag", tagId);
    } catch (err) {
      console.warn("unfollow tag failed", err);
    }
  };

  const onUnfollowQuestion = async (qid) => {
    try {
      await unfollow("question", qid);
    } catch (err) {
      console.warn("unfollow question failed", err);
    }
  };

  const onToggleMuteQuestion = async (qid) => {
    try {
      await toggleMute("question", qid);
    } catch (err) {
      console.warn("mute toggle failed", err);
    }
  };

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="hero">
            <h1>My Subscriptions</h1>
            <p>
              Manage your topics and discover personalized FAQ
              recommendations.
            </p>
          </div>

          {!user ? (
            <div className="empty-state">
              <p>Please log in to see your subscriptions.</p>
            </div>
          ) : (
            <>
              <section>
                <h2 className="section-heading">Subscribed Topics</h2>

                {!loaded && loading ? (
                  <p className="muted">Loading your subscriptions…</p>
                ) : followedTags.length === 0 ? (
                  <div className="empty-state">
                    <p>
                      You haven't followed any topics yet. Follow a hashtag
                      on any question to start seeing relevant FAQs here.
                    </p>
                  </div>
                ) : (
                  <div className="categories-grid">
                    {followedTags.map((tag) => (
                      <div key={tag} className="category-card">
                        <div className="category-icon-circle blue">
                          <span className="category-icon-emoji">🏷</span>
                        </div>
                        <h3 className="category-card-title">
                          #{tag}
                        </h3>
                        <p className="category-card-desc">
                          Questions tagged with #{tag}
                        </p>
                        <button
                          className="unsubscribe-btn"
                          onClick={() => onUnfollowTag(tag)}
                        >
                          Unsubscribe
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="section-heading">Followed Questions</h2>

                {followedQuestionIds.length === 0 ? (
                  <div className="empty-state">
                    <p>
                      You haven't followed any questions yet. Use the
                      "Follow" button on a question page to get updates.
                    </p>
                  </div>
                ) : (
                  <div className="categories-grid">
                    {followedQuestionIds.map((qid) => {
                      const rec = follows.get(`question::${qid}`);
                      const q = questionById.get(String(qid));
                      // Prefer the human-readable title. If the question isn't
                      // in the local cache (e.g., deleted, not yet loaded, or
                      // belongs to the anonymous "local-" set the user can't
                      // view), fall back to a friendly placeholder rather
                      // than dumping a raw id.
                      const title =
                        q?.title || q?.question || "Question (loading…)";
                      return (
                        <div key={qid} className="category-card">
                          <div className="category-icon-circle blue">
                            <span className="category-icon-emoji">🔔</span>
                          </div>
                          <h3 className="category-card-title">
                            <Link to={`/questions/${qid}`}>{title}</Link>
                          </h3>
                          <p className="category-card-desc">
                            {q?.category ? `Category: ${q.category}` : `ID: ${qid}`}
                          </p>
                          <p className="category-card-count">
                            Notifications: {rec?.isMuted ? "Muted" : "On"}
                          </p>
                          <button
                            className="unsubscribe-btn"
                            onClick={() => onToggleMuteQuestion(qid)}
                          >
                            {rec?.isMuted ? "Unmute" : "Mute"}
                          </button>
                          <button
                            className="unsubscribe-btn"
                            onClick={() => onUnfollowQuestion(qid)}
                            style={{ marginTop: "6px" }}
                          >
                            Unfollow
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <h2 className="section-heading">For You</h2>

                {feedLoading ? (
                  <p className="muted">Loading recommendations…</p>
                ) : feedError ? (
                  <p className="error">{feedError}</p>
                ) : feed.items.length === 0 ? (
                  <div className="empty-state">
                    <p>
                      Follow a few topics to see matching questions here.
                    </p>
                  </div>
                ) : (
                  <div className="categories-grid">
                    {feed.items.map((item) => (
                      <div
                        key={`${item.sourceType}::${item.id}`}
                        className="category-card"
                      >
                        <div className="category-icon-circle blue">
                          <span className="category-icon-emoji">
                            {item.sourceType === "faq" ? "📘" : "❓"}
                          </span>
                        </div>
                        <h3 className="category-card-title">
                          <Link
                            to={
                              item.sourceType === "faq"
                                ? `/faqs/${item.id}`
                                : `/questions/${item.id}`
                            }
                          >
                            {item.title}
                          </Link>
                        </h3>
                        <p className="category-card-desc">
                          {(item.tags || []).slice(0, 3).map((t) => (
                            <Hashtag
                              key={t}
                              tag={t}
                              size="sm"
                              variant="inline"
                            />
                          ))}
                        </p>
                        <p className="category-card-count">
                          ▲ {item.upvotes || 0} · {item.reason === "followed_question" ? "Followed question" : "Matches a topic you follow"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default Subscription;