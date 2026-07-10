const analyticsData = [
  { label: "Profile Views",          value: "1.8K", change: "+18%", points: "0,22 16,18 32,20 48,12 64,14 80,6" },
  { label: "FAQ Views",              value: "9.6K", change: "+24%", points: "0,20 16,14 32,16 48,8 64,10 80,3"  },
  { label: "Search Appearances",     value: "3.2K", change: "+12%", points: "0,18 16,16 32,12 48,14 64,8 80,10" },
  { label: "Answer Acceptance Rate", value: "87%",  change: "+8%",  points: "0,20 16,16 32,18 48,10 64,12 80,6" },
];

function Analytics() {
  return (
    <div className="analytics-card profile-card">
      <div className="card-header-row">
        <h3>Analytics Overview</h3>
        <select className="analytics-period-select">
          <option>Last 30 days</option>
          <option>Last 7 days</option>
          <option>Last 90 days</option>
        </select>
      </div>
      <div className="analytics-grid">
        {analyticsData.map((a) => (
          <div key={a.label} className="analytics-box">
            <span className="analytics-label">{a.label}</span>
            <strong className="analytics-value">{a.value}</strong>
            <span className="analytics-change positive">{a.change}</span>
            <svg className="sparkline" viewBox="0 0 80 28" fill="none">
              <polyline points={a.points}
                stroke="#2563EB" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Analytics;