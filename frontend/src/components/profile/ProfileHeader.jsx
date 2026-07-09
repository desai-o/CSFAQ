import { PencilIcon, UsersIcon, MapPinIcon, MailIcon } from "./ProfileIcons";
import { useAuth } from "../../context/AuthContext";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

function ProfileHeader() {
  const { user } = useAuth();

  if (!user) return null;

  const handle = `@${user.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  return (
    <section className="profile-header-card">
      <div className="profile-header-left">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar-blank" style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-hover)", width: "100%", height: "100%", borderRadius: "50%" }}>
            {getInitials(user.name)}
          </div>
          <button className="avatar-edit-btn" aria-label="Edit photo">
            <PencilIcon size={11} color="#64748b" />
          </button>
        </div>

        <div className="profile-user-info">
          <div className="profile-name-row">
            <h2 className="profile-name">{user.name}</h2>
            <span className="profile-pro-badge">Contributor</span>
          </div>
          <p className="profile-handle">{handle}</p>
          <p className="profile-title">Developer & Contributor at CrowdFAQ</p>
          <div className="profile-meta">
            <span className="profile-meta-item">
              <MapPinIcon size={13} color="#9ca3af" /> Remote, USA
            </span>
            <span className="profile-meta-item">
              <UsersIcon size={13} color="#9ca3af" /> Community Member
            </span>
          </div>
          <p className="profile-bio">
            I love asking questions, sharing answers, and contributing to the open-source community knowledge base.
          </p>
          <a href={`mailto:${user.email}`} className="profile-email-link">
            <MailIcon size={13} color="#2563eb" />
            {user.email}
          </a>
        </div>
      </div>

      <div className="profile-header-right">
        <button className="edit-profile-btn">
          <PencilIcon size={13} color="#374151" /> Edit Profile
        </button>
        <div className="profile-details-grid">
          {[
            ["Username",     handle],
            ["Email",        user.email],
            ["Role",         "Contributor"],
            ["Storage Mode", user.storage === "mongodb" ? "MongoDB Atlas" : "SQLite Fallback"],
            ["Member since", "Jun 13, 2026"],
          ].map(([label, value]) => (
            <div className="profile-detail-row" key={label}>
              <span className="detail-label">{label}</span>
              <span className="detail-value">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ProfileHeader;