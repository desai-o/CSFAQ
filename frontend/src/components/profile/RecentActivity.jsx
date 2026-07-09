const recentActivity = [
  { text: 'Answered "Best roadmap for AI/ML in 2026?"',        time: "2 days ago",   color: "#2563EB" },
  { text: 'Asked "When should I use recursion vs iteration?"', time: "1 week ago",   color: "#D97706" },
  { text: 'Earned the "Sharpshooter" badge',                   time: "Feb 15, 2025", color: "#059669" },
];

function RecentActivity() {
  return (
    <div className="activity-card profile-card">
      <div className="card-header-row">
        <h3>Recent Activity</h3>
        <button className="view-all-btn">View all</button>
      </div>
      <ul className="activity-list">
        {recentActivity.map((a, i) => (
          <li key={i} className="activity-item">
            <span className="activity-dot" style={{ background: a.color }} />
            <div className="activity-text">
              <p>{a.text}</p>
              <span className="activity-time">{a.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RecentActivity;