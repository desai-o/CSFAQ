import { useState } from "react";
import TrendingQuestions from "../components/TrendingQuestions";
import StatsGrid from "../components/StatsGrid";
import CommunityHeatmap from "../components/CommunityHeatmap";
import ActivityGraph from "../components/ActivityGraph";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import { useFAQ } from "../context/FAQContext";

function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const { categories } = useFAQ();

  return (
    <>
      <Sidebar />

      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />

        <main className="content">
          <section className="hero">
            <h1>
              Crowd-Sourced
              <br />
              <span className="hero-accent">Knowledge Hub</span>
            </h1>
            <p>Ask questions, discover answers, and learn from your community.</p>
          </section>

          <section className="dashboard-overview">
            <div className="dashboard-overview-left">
              <div className="stats-panel">
                <StatsGrid />
              </div>
              <CommunityHeatmap />
            </div>

            <div className="dashboard-overview-right">
              <ActivityGraph />
            </div>
          </section>

          <div className="dashboard-grid">
            <div className="dashboard-main">
              <TrendingQuestions />
            </div>

            <div className="right-sidebar">
              <div className="cta-card">
                <h3>Have a Question?</h3>
                <p>Don't hesitate to ask! Our community of experts is ready to help you find the answers you need.</p>
                <button className="cta-ask-btn" onClick={() => setShowModal(true)}>+ Ask a Question</button>
              </div>

              <div className="categories-widget">
                <h4 className="widget-title">Categories</h4>
                <ul className="cat-list">
                  {categories.map((cat) => (
                    <li key={cat.name}>
                      <span className={`cat-dot ${cat.color}`}></span>
                      {cat.name}
                      <span className="cat-count">{cat.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

export default Dashboard;
