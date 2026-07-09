import { useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import { useFAQ } from "../context/FAQContext";

function Categories() {
  const [showModal, setShowModal] = useState(false);
  const { categories, questions } = useFAQ();

  const getCategoryColor = (categoryName) => {
    const categoryColors = {
      "Programming": "blue",
      "Artificial Intelligence": "orange",
      "Career": "green",
      "Research": "yellow",
      "Scholarships": "red",
      "Mathematics": "purple"
    };
    return categoryColors[categoryName] || "blue";
  };

  // Get 6 most recently active questions (newest first)
  const recentQuestions = [...questions]
    .sort((a, b) => {
      const aVal = typeof a.id === "number" ? a.id : 0;
      const bVal = typeof b.id === "number" ? b.id : 0;
      return bVal - aVal;
    })
    .slice(0, 6);

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />
        <main className="content">
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Browse questions by topic area</p>

          <div className="categories-grid">
            {categories.map((cat) => (
              <div key={cat.name} className="category-card">
                <div className={`category-icon-circle ${cat.color}`}>
                  <span className="category-icon-emoji">{cat.icon}</span>
                </div>
                <h3 className="category-card-title">{cat.name}</h3>
                <p className="category-card-desc">{cat.description}</p>
                <span className="category-card-count">{cat.questions} questions</span>
              </div>
            ))}
          </div>

          <section className="recent-activity-section">
            <h2 className="section-heading">Recently Active</h2>
            <div className="question-list-flat">
              {recentQuestions.map((q, index) => {
                const color = getCategoryColor(q.category);
                return (
                  <div key={q.id}>
                    <div className="recent-item">
                      <span className={`cat-dot ${color}`}></span>
                      <div className="recent-body">
                        <h3 className="q-title q-title-blue">
                          <Link to={`/questions/${q.id}`}>{q.title}</Link>
                        </h3>
                        <div className="recent-meta">
                          <span className="tag category">{q.category}</span>
                          <span className="q-meta">💬 {q.answers ? q.answers.length : 0} answers • {q.time}</span>
                        </div>
                      </div>
                    </div>
                    {index !== recentQuestions.length - 1 && <div className="divider"></div>}
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

export default Categories;