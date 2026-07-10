import { TrophyIcon } from "./ProfileIcons";

function TopFAQ() {
  return (
    <div className="top-faq-card profile-card">
      <div className="card-header-row">
        <h3>Top FAQ <span className="card-subhead">(by views)</span></h3>
        <button className="view-all-btn">View all</button>
      </div>
      <div className="top-faq-item">
        <div className="top-faq-icon-wrap">
          <TrophyIcon size={22} color="#D97706" />
        </div>
        <div className="top-faq-text">
          <p className="top-faq-title">API Authentication Guide</p>
          <p className="top-faq-sub">Your most viewed FAQ</p>
        </div>
        <div className="top-faq-views">
          <span className="top-faq-num">2.5K</span>
          <span className="top-faq-label">Views</span>
        </div>
      </div>
    </div>
  );
}

export default TopFAQ;