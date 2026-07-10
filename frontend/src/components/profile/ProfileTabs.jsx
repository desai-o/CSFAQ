import { GridIcon, FileIcon, BarChartIcon, MedalIcon, SettingsIcon } from "./ProfileIcons";

const tabs = [
  { label: "Overview",         Icon: GridIcon      },
  { label: "My Content",       Icon: FileIcon      },
  { label: "Analytics",        Icon: BarChartIcon  },
  { label: "Badges",           Icon: MedalIcon     },
  { label: "Account Settings", Icon: SettingsIcon  },
];

function ProfileTabs({ activeTab, setActiveTab }) {
  return (
    <section className="profile-tabs-container">
      {tabs.map((t) => (
        <button
          key={t.label}
          className={`profile-tab-btn ${activeTab === t.label ? "active" : ""}`}
          onClick={() => setActiveTab(t.label)}
        >
          <t.Icon size={15} />
          {t.label}
        </button>
      ))}
    </section>
  );
}

export default ProfileTabs;