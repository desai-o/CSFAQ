import { Link } from "react-router-dom";
import { useFAQ } from "../context/FAQContext";
import Hashtag from "./Hashtag";
import { timeAgo } from "../utils/timeAgo";

function TrendingQuestions() {
  const { questions, upvoteQuestion } = useFAQ();

  const trending = [...questions]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3);

  return (
    <div className="trending-card">
      <div className="trending-header">
        <h2>Trending Questions</h2>
        <span className="hot-badge">🔥 Hot</span>
      </div>

      <div className="trending-list">
        {trending.map((q, index) => (
          <div key={q.id}>
            <div className="question-item">
              <div className="vote-col">
                <button
                  className={`upvote ${q.voted ? "upvoted" : ""}`}
                  onClick={() => upvoteQuestion(q.id)}
                >
                  ▲
                </button>
                <span className="vote-count">{q.votes}</span>
              </div>
              <div className="question-body">
                <div className="q-tags">
                  {q.answers && q.answers.length > 0 && <span className="tag answered">✓ Answered</span>}
                  <span className="tag category">{q.category}</span>
                </div>
                <h3 className="q-title">
                  <Link to={`/questions/${q.id}`}>{q.title}</Link>
                </h3>
                <p className="q-excerpt">{q.excerpt}</p>
                <div className="q-footer">
                  <div className="q-hashtags">
                    {(Array.isArray(q.hashtags) ? q.hashtags : []).map((tag) => (
                      <Hashtag key={tag} tag={tag} />
                    ))}
                  </div>
                  <div className="q-meta">
                    👤 {q.author || "Community"} &nbsp; 💬 {q.answers ? q.answers.length : 0} answers &nbsp; <span className="time-ago">{timeAgo(q.createdAt || q.time)}</span>
                  </div>
                </div>
              </div>
            </div>
            {index < trending.length - 1 && <div className="divider"></div>}
          </div>
        ))}
      </div>
      <div className="view-all-row">
        <Link to="/questions" className="view-all-link">View all trending questions →</Link>
      </div>
    </div>
  );
}

export default TrendingQuestions;