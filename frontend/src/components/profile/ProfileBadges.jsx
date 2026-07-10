import { TrophyIcon, StarIcon, RocketIcon, FlameIcon, TargetIcon } from "./ProfileIcons";

const badges = [
  { label: "Top Contributor", Icon: TrophyIcon, color: "#7C3AED", bg: "#EDE9FE", ring: "#C4B5FD" },
  { label: "Expert",          Icon: StarIcon,   color: "#1D4ED8", bg: "#DBEAFE", ring: "#93C5FD" },
  { label: "AI/ML Guru",      Icon: RocketIcon, color: "#047857", bg: "#D1FAE5", ring: "#6EE7B7" },
  { label: "Hot Question",    Icon: FlameIcon,  color: "#B45309", bg: "#FEF3C7", ring: "#FCD34D" },
  { label: "Sharp Shooter",   Icon: TargetIcon, color: "#B91C1C", bg: "#FEE2E2", ring: "#FCA5A5" },
];

function ProfileBadges() {
  return (
    <div className="badges-card profile-card">
      <div className="card-header-row">
        <h3>Badges</h3>
        <button className="view-all-btn">View all</button>
      </div>
      <div className="badges-icon-row">
        {badges.map((b) => (
          <div key={b.label} className="badge-icon-item">
            <div className="badge-circle" style={{ background: b.bg, borderColor: b.ring }}>
              <div className="badge-inner-ring" style={{ borderColor: b.color + "30" }}>
                <b.Icon size={20} color={b.color} />
              </div>
            </div>
            <span className="badge-icon-label" style={{ color: b.color }}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProfileBadges;