import {
  MessagePlusIcon, PencilIcon, SendIcon,
  BookmarkIcon, ClockIcon, ChevronRightIcon
} from "./ProfileIcons";

const quickLinks = [
  { label: "My FAQs",         count: 128, Icon: () => <MessagePlusIcon size={15} color="#64748b" /> },
  { label: "Draft FAQs",      count: 18,  Icon: () => <PencilIcon size={15} color="#64748b" /> },
  { label: "Published FAQs",  count: 110, Icon: () => <SendIcon size={15} color="#64748b" /> },
  { label: "Bookmarked FAQs", count: 56,  Icon: () => <BookmarkIcon size={15} color="#64748b" /> },
  { label: "Recently Viewed", count: 20,  Icon: () => <ClockIcon size={15} color="#64748b" /> },
];

function QuickLinks() {
  return (
    <div className="quick-links-card profile-card">
      <h3 className="quick-links-heading">Quick Links</h3>
      <div className="quick-links">
        {quickLinks.map((link) => (
          <button key={link.label} className="quick-link-row">
            <span className="quick-link-icon"><link.Icon /></span>
            <span className="quick-link-label">{link.label}</span>
            <span className="quick-link-count">{link.count}</span>
            <span className="quick-link-arrow">
              <ChevronRightIcon size={15} color="#cbd5e1" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickLinks;