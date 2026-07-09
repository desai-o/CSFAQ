import { useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import Hashtag from "../components/Hashtag";
import { useFAQ } from "../context/FAQContext";

function Bookmarks() {
  const [showModal, setShowModal] = useState(false);
  const { questions, bookmarkQuestion } = useFAQ();

  const bookmarks = questions.filter((q) => q.bookmarked);

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />
        <main className="content">
          <h1 className="page-title">My Bookmarks</h1>
          <p className="page-subtitle">Your saved questions for quick reference</p>

          {bookmarks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔖</span>
              <h3>No bookmarks yet</h3>
              <p>Start bookmarking questions to save them for later!</p>
            </div>
          ) : (
            <div className="bookmarks-list">
              {bookmarks.map((q) => (
                <div key={q.id} className="bookmark-card">
                  <div className="bookmark-body">
                    <div className="q-tags">
                      <span className="tag category">{q.category}</span>
                    </div>

                    <h3 className="q-title q-title-blue">
                      <Link to={`/questions/${q.id}`}>{q.title}</Link>
                    </h3>

                    <p className="q-excerpt">{q.excerpt}</p>

                    <div className="q-footer">
                      <div className="q-hashtags">
                        {q.hashtags.map((tag) => (
                          <Hashtag key={tag} tag={tag} />
                        ))}
                      </div>
                      <div className="q-meta">
                        ▲ {q.votes} • 💬 {q.answers ? q.answers.length : 0} answers • {q.time}
                      </div>
                    </div>
                  </div>

                  <button
                    className="remove-bookmark-btn"
                    onClick={() => bookmarkQuestion(q.id)}
                    title="Remove bookmark"
                  >
                    ✕ Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

export default Bookmarks;