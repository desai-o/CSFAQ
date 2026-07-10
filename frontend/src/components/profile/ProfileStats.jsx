import {
  MessagePlusIcon, PencilIcon, SendIcon,
  MessageCircleIcon, EyeIcon, ThumbsUpIcon
} from "./ProfileIcons";
import { useFAQ } from "../../context/FAQContext";
import { useAuth } from "../../context/AuthContext";

function ProfileStats() {
  const { contributors } = useFAQ();
  const { user } = useAuth();

  if (!user) return null;

  // Retrieve current user dynamically from FAQ Context (contributors list) or fall back to AuthContext properties
  const currentUser = contributors.find((c) => c.name === user.name) || {
    questions: user.questionsCount || 0,
    answers: user.answersCount || 0,
    reputation: user.reputation || 0,
  };

  const stats = [
    { label: "FAQs Created",      value: currentUser.questions,   Icon: () => <MessagePlusIcon size={18} color="#2563eb" /> },
    { label: "FAQs Edited",       value: 0,                       Icon: () => <PencilIcon size={18} color="#2563eb" /> },
    { label: "Answers Submitted", value: currentUser.answers,     Icon: () => <SendIcon size={18} color="#2563eb" /> },
    { label: "Comments Added",    value: 0,                       Icon: () => <MessageCircleIcon size={18} color="#2563eb" /> },
    { label: "Total Views",       value: (currentUser.questions * 12 + currentUser.answers * 15), Icon: () => <EyeIcon size={18} color="#2563eb" /> },
    { label: "Helpful Votes",     value: Math.floor(currentUser.reputation / 10),  Icon: () => <ThumbsUpIcon size={18} color="#2563eb" /> },
  ];

  return (
    <section className="profile-stats-row">
      {stats.map((s) => (
        <div key={s.label} className="profile-stat-card">
          <div className="stat-icon-wrap">
            <s.Icon />
          </div>
          <div className="stat-text">
            <h3>{s.value}</h3>
            <p>{s.label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

export default ProfileStats;