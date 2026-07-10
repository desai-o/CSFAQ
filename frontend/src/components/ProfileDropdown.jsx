import React, { useEffect, useRef } from "react";
import { useFAQ } from "../context/FAQContext";
import "./ProfileDropdown.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Tabler Icons represented as clean inline SVGs
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BookmarkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const KeyboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <line x1="6" y1="8" x2="6" y2="8" />
    <line x1="10" y1="8" x2="10" y2="8" />
    <line x1="14" y1="8" x2="14" y2="8" />
    <line x1="18" y1="8" x2="18" y2="8" />
    <line x1="6" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="18" y2="12" />
    <line x1="7" y1="16" x2="17" y2="16" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

function ProfileDropdown({ isOpen, onClose }) {
  const { contributors } = useFAQ();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  if (!user) return null;

  // Retrieve current user dynamically from FAQ Context (contributors list) or fall back to AuthContext properties
  const currentUser = contributors.find((c) => c.name === user.name) || {
    name: user.name,
    avatar: user.name.charAt(0).toUpperCase(),
    questions: user.questionsCount || 0,
    answers: user.answersCount || 0,
    reputation: user.reputation || 0,
  };

  // Attach outside click listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      // If the target is the avatar button, let Topbar's own toggle handler manage it
      if (e.target.closest(".avatar")) return;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`profile-dropdown ${isOpen ? "open" : ""}`} ref={dropdownRef}>
      {/* User Header */}
      <div className="profile-dropdown-header">
        <div className="profile-dropdown-avatar">{currentUser.avatar}</div>
        <div className="profile-dropdown-info">
          <h4>{currentUser.name}</h4>
          <p>{user.email}</p>
        </div>
      </div>

      {/* User Stats Grid */}
      <div className="profile-dropdown-stats">
        <div className="profile-stat-box">
          <span className="stat-val">{currentUser.questions}</span>
          <span className="stat-lbl">Questions</span>
        </div>
        <div className="profile-stat-box">
          <span className="stat-val">{currentUser.answers}</span>
          <span className="stat-lbl">Answers</span>
        </div>
        <div className="profile-stat-box">
          <span className="stat-val">{currentUser.reputation.toLocaleString()}</span>
          <span className="stat-lbl">Reputation</span>
        </div>
      </div>

      {/* Dropdown Menu Items */}
      <ul className="profile-dropdown-menu">
        <li>
          <Link to="/profile" onClick={onClose}>
            <UserIcon />
            <span>My Profile</span>
          </Link>
        </li>
        {user && (user.role === "admin" || user.role === "moderator") && (
          <li>
            <Link to="/admin" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span>Admin Console</span>
            </Link>
          </li>
        )}
        <li>
          <a href="#questions" onClick={(e) => { e.preventDefault(); onClose(); }}>
            <MessageSquareIcon />
            <span>My Questions</span>
          </a>
        </li>
        <li>
          <Link to="/bookmarks" onClick={onClose}>
            <BookmarkIcon />
            <span>Bookmarks</span>
          </Link>
        </li>
        <li>
          <Link to="/profile"
            state={{ activeTab: "Account Settings"}}
            onClick={onClose}
            >
            <SettingsIcon />
            <span>Settings</span>
          </Link>
        </li>
        <li>
          <a href="#shortcuts" onClick={(e) => { e.preventDefault(); onClose(); }}>
            <KeyboardIcon />
            <span>Keyboard Shortcuts</span>
          </a>
        </li>
        <li className="dropdown-divider"></li>
        <li>
          <a href="#logout" className="logout-btn" onClick={(e) => { e.preventDefault(); logout(); navigate("/"); onClose(); }}>
            <LogOutIcon />
            <span>Sign Out</span>
          </a>
        </li>
      </ul>
    </div>
  );
}

export default ProfileDropdown;
