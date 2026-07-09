import { FileIcon, EyeIcon, ThumbsUpIcon } from "./ProfileIcons";

const recentContent = [
  { title: "How to Reset Password",           status: "Published", views: "1.2K", votes: 45   },
  { title: "Two Factor Authentication Setup", status: "Published", views: "980",  votes: 38   },
  { title: "Integrating API with Python",     status: "Draft",     views: null,   votes: null },
  { title: "Rate Limiting Best Practices",    status: "Published", views: "760",  votes: 25   },
  { title: "Webhook Verification Guide",      status: "Draft",     views: null,   votes: null },
];

function RecentContent() {
  return (
    <div className="recent-content-card profile-card">
      <div className="card-header-row">
        <h3>Recent Content</h3>
        <button className="view-all-btn">View all</button>
      </div>
      <table className="content-table">
        <tbody>
          {recentContent.map((item) => (
            <tr key={item.title} className="content-table-row">
              <td className="content-table-icon">
                <FileIcon size={14} color="#cbd5e1" />
              </td>
              <td className="content-table-title">
                {item.title}
                <span className={`content-status ${item.status === "Published" ? "status-published" : "status-draft"}`}>
                  {item.status}
                </span>
              </td>
              <td className="content-table-stat">
                {item.views
                  ? <span className="stat-with-icon"><EyeIcon size={12} color="#94a3b8" /> {item.views}</span>
                  : <span className="stat-empty">—</span>}
              </td>
              <td className="content-table-stat">
                {item.votes !== null
                  ? <span className="stat-with-icon"><ThumbsUpIcon size={12} color="#94a3b8" /> {item.votes}</span>
                  : <span className="stat-empty">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RecentContent;