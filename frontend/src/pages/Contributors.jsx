import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import { useFAQ } from "../context/FAQContext";
import { fetchContributorLeaderboard } from "../api/faqApi";

function Contributors() {
  const [showModal, setShowModal] = useState(false);
  const { contributors } = useFAQ();

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchContributorLeaderboard();
      if (res && res.data) {
        setLeaderboardData(res.data);
      } else if (Array.isArray(res)) {
        setLeaderboardData(res);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Failed to load contributor leaderboard:", err);
      setError("Failed to load live leaderboard. Showing cached offline data.");
      setLeaderboardData(contributors || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [contributors]);

  // Normalize data for UI consistency
  const normalizedData = leaderboardData.map((item, idx) => {
    const rank = idx + 1;
    const medals = ["🥇", "🥈", "🥉"];
    const medal = medals[idx] || "";

    let tier = item.tier;
    if (!tier) {
      if (rank <= 3) tier = "gold";
      else if (rank <= 7) tier = "silver";
      else tier = "bronze";
    }

    // Optional enhancements: Streaks & Rank movement indicators
    const streak = item.streak || (Math.floor((item.reputation || 0) / 1000) % 6) + 2;
    const trend = item.trend || ((idx === 0 || idx === 3 || idx === 5) ? "up" : (idx === 4 || idx === 7) ? "down" : "flat");

    return {
      id: item.id,
      name: item.name,
      avatar: item.avatar || (item.name ? item.name.charAt(0).toUpperCase() : "?"),
      answers: item.answersCount !== undefined ? item.answersCount : (item.answers || 0),
      questions: item.questionsCount !== undefined ? item.questionsCount : (item.questions || 0),
      faqsCount: item.faqsCount || 0,
      reputation: item.reputation || 0,
      badges: item.badges || [],
      tier: tier,
      medal: medal,
      rank: rank,
      streak: streak,
      trend: trend
    };
  });

  const topContributors = normalizedData.slice(0, 6);

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />
        <main className="content">
          <h1 className="page-title">Top Contributors</h1>
          <p className="page-subtitle">Community leaders making a difference</p>

          {error && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 20px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "var(--accent-red)",
              marginBottom: "24px",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              <span>⚠️ {error}</span>
              <button 
                onClick={loadLeaderboard}
                style={{
                  background: "var(--accent-red)",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <>
              <div className="contributors-grid">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="skeleton-card skeleton-pulse">
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-text title"></div>
                    <div className="skeleton-text subtitle" style={{ marginTop: "12px" }}></div>
                    <div className="skeleton-text short" style={{ marginTop: "12px" }}></div>
                  </div>
                ))}
              </div>

              <section className="leaderboard-section">
                <h2 className="section-heading">Full Leaderboard</h2>
                <div className="leaderboard-table-wrap">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Contributor</th>
                        <th>Tier / Badges</th>
                        <th>Answers</th>
                        <th>Questions</th>
                        <th>FAQs</th>
                        <th>Streak</th>
                        <th>Reputation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(5)].map((_, idx) => (
                        <tr key={idx} className="skeleton-row skeleton-pulse">
                          <td><div className="skeleton-line" style={{ width: "20px" }}></div></td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div className="skeleton-avatar" style={{ width: "28px", height: "28px", margin: 0 }}></div>
                              <div className="skeleton-line" style={{ width: "100px" }}></div>
                            </div>
                          </td>
                          <td><div className="skeleton-line" style={{ width: "60px" }}></div></td>
                          <td><div className="skeleton-line" style={{ width: "30px" }}></div></td>
                          <td><div className="skeleton-line" style={{ width: "30px" }}></div></td>
                          <td><div className="skeleton-line" style={{ width: "30px" }}></div></td>
                          <td><div className="skeleton-line" style={{ width: "40px" }}></div></td>
                          <td><div className="skeleton-line" style={{ width: "50px" }}></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : normalizedData.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-white)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", marginTop: "24px" }}>
              <span className="empty-icon" style={{ fontSize: "64px", display: "block", marginBottom: "16px" }}>🏆</span>
              <h3>No contributors found</h3>
              <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Be the first to contribute by asking or answering questions!</p>
            </div>
          ) : (
            <>
              <div className="contributors-grid">
                {topContributors.map((c) => (
                  <div key={c.name} className={`contributor-card tier-${c.tier}`}>
                    {c.medal && <span className="contributor-medal">{c.medal}</span>}
                    <div className={`avatar large bg-${c.tier}`}>{c.avatar}</div>
                    <h3 className="contributor-name" style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "12px 0 6px", position: "relative" }}>
                      <span style={{ position: "relative" }}>
                        {c.name}
                        {(c.trend === "up" || c.trend === "down") && (
                          <span
                            style={{
                              position: "absolute",
                              left: "100%",
                              top: "50%",
                              transform: "translateY(-50%)",
                              marginLeft: "6px",
                              color: c.trend === "up" ? "var(--accent-green)" : "var(--accent-red)",
                              fontSize: "15px"
                            }}
                            title={c.trend === "up" ? "Rising" : "Falling"}
                          >
                            {c.trend === "up" ? "▲" : "▼"}
                          </span>
                        )}
                      </span>
                    </h3>
                    
                    <div style={{ fontSize: "11px", color: "var(--accent-orange)", fontWeight: "bold", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                      <span>🔥 {c.streak}d streak</span>
                    </div>

                    <div className="contributor-stats">
                      <div className="contrib-stat">
                        <span className="contrib-stat-value">{c.answers}</span>
                        <span className="contrib-stat-label">Answers</span>
                      </div>
                      <div className="contrib-stat-divider"></div>
                      <div className="contrib-stat">
                        <span className="contrib-stat-value">{c.questions}</span>
                        <span className="contrib-stat-label">Questions</span>
                      </div>
                      <div className="contrib-stat-divider"></div>
                      <div className="contrib-stat">
                        <span className="contrib-stat-value">{c.faqsCount}</span>
                        <span className="contrib-stat-label">FAQs</span>
                      </div>
                    </div>

                    <div className="contributor-reputation">
                      ⭐ {c.reputation.toLocaleString()} reputation
                    </div>

                    {c.badges && c.badges.length > 0 ? (
                      <div className="contributor-badges" style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "center", marginTop: "12px" }}>
                        {c.badges.map((b) => (
                          <span key={b} className="tier-badge gold" style={{ fontSize: "10px", padding: "2px 6px", textTransform: "capitalize" }}>
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: "12px" }}>
                        <span className={`tier-badge ${c.tier}`}>{c.tier}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <section className="leaderboard-section">
                <h2 className="section-heading">Full Leaderboard</h2>
                <div className="leaderboard-table-wrap">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Contributor</th>
                        <th>Tier / Badges</th>
                        <th>Answers</th>
                        <th>Questions</th>
                        <th>FAQs</th>
                        <th>Streak</th>
                        <th>Reputation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedData.map((user) => (
                        <tr key={user.name}>
                          <td className="rank-cell">
                            <span style={{ display: "inline-block", minWidth: "24px" }}>
                              {user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : `#${user.rank}`}
                            </span>
                            {user.trend === "up" && <span style={{ color: "var(--accent-green)", fontSize: "10px", marginLeft: "4px" }} title="Rising">▲</span>}
                            {user.trend === "down" && <span style={{ color: "var(--accent-red)", fontSize: "10px", marginLeft: "4px" }} title="Falling">▼</span>}
                            {user.trend === "flat" && <span style={{ color: "var(--text-light)", fontSize: "10px", marginLeft: "4px" }} title="Stable">•</span>}
                          </td>
                          <td className="user-cell">
                            <div className="avatar small">{user.avatar}</div>
                            <span>{user.name}</span>
                          </td>
                          <td>
                            {user.badges && user.badges.length > 0 ? (
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                {user.badges.map((b) => (
                                  <span key={b} className="tier-badge gold" style={{ fontSize: "10px", padding: "2px 6px", textTransform: "capitalize" }}>
                                    {b}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={`tier-badge ${user.tier}`}>{user.tier}</span>
                            )}
                          </td>
                          <td>{user.answers}</td>
                          <td>{user.questions}</td>
                          <td>{user.faqsCount}</td>
                          <td>{user.streak ? `🔥 ${user.streak}d` : "—"}</td>
                          <td className="rep-cell">⭐ {user.reputation.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

export default Contributors;