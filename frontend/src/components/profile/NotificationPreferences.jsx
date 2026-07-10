import { useState, useEffect } from "react";
import { fetchNotificationPreferences, updateNotificationPreferences } from "../../api/faqApi";

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    inAppNotifications: true,
    digestFrequency: "none",
    tagPreferences: []
  });
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    async function loadPrefs() {
      try {
        const response = await fetchNotificationPreferences();
        if (response?.data) {
          setPrefs({
            emailNotifications: response.data.emailNotifications ?? true,
            inAppNotifications: response.data.inAppNotifications ?? true,
            digestFrequency: response.data.digestFrequency || "none",
            tagPreferences: response.data.tagPreferences || []
          });
        }
      } catch (err) {
        console.error("Failed to load notification preferences:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPrefs();
  }, []);

  const handleToggle = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectFrequency = (e) => {
    setPrefs((prev) => ({ ...prev, digestFrequency: e.target.value }));
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    const tag = newTag.trim().toLowerCase();
    if (tag && !prefs.tagPreferences.includes(tag)) {
      setPrefs((prev) => ({
        ...prev,
        tagPreferences: [...prev.tagPreferences, tag]
      }));
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag) => {
    setPrefs((prev) => ({
      ...prev,
      tagPreferences: prev.tagPreferences.filter((t) => t !== tag)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await updateNotificationPreferences(prefs);
      setMessage({ type: "success", text: "Preferences saved successfully!" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to save preferences." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="settings-loading">Loading preferences...</div>;
  }

  return (
    <div className="profile-card premium-settings-card">
      <div className="settings-header">
        <h3>Notification Preferences</h3>
        <p className="settings-subtitle">Manage how and when you receive updates from CrowdFAQ.</p>
      </div>

      <div className="settings-sections">
        {/* Switch toggles */}
        <div className="settings-section">
          <h4 className="settings-section-title">Channels</h4>
          
          <div className="switch-row">
            <div className="switch-info">
              <span className="switch-label">Email Notifications</span>
              <p className="switch-desc">Receive email alerts for direct interactions, comments, and mentions.</p>
            </div>
            <label className="premium-switch">
              <input
                type="checkbox"
                checked={prefs.emailNotifications}
                onChange={() => handleToggle("emailNotifications")}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="switch-row">
            <div className="switch-info">
              <span className="switch-label">In-App Notifications</span>
              <p className="switch-desc">Show notification badge and popups while you are using the app.</p>
            </div>
            <label className="premium-switch">
              <input
                type="checkbox"
                checked={prefs.inAppNotifications}
                onChange={() => handleToggle("inAppNotifications")}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Digest Frequency */}
        <div className="settings-section">
          <h4 className="settings-section-title">Activity Digest</h4>
          <p className="section-desc">Get a periodic summary of top questions, answers, and activities in your tags.</p>
          <div className="digest-options">
            {["none", "daily", "weekly"].map((freq) => (
              <label key={freq} className={`digest-radio-label ${prefs.digestFrequency === freq ? "active" : ""}`}>
                <input
                  type="radio"
                  name="digestFrequency"
                  value={freq}
                  checked={prefs.digestFrequency === freq}
                  onChange={handleSelectFrequency}
                  className="hidden-radio"
                />
                <span className="radio-text">{freq.charAt(0).toUpperCase() + freq.slice(1)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Tag Preferences */}
        <div className="settings-section">
          <h4 className="settings-section-title">Tag Subscription</h4>
          <p className="section-desc">Subscribe to specific tags to receive notifications when new questions are posted.</p>
          
          <form onSubmit={handleAddTag} className="tag-input-form">
            <input
              type="text"
              placeholder="e.g. react, python, database"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="tag-input"
            />
            <button type="submit" className="add-tag-btn">Add Tag</button>
          </form>

          <div className="tags-container" style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {prefs.tagPreferences.map((tag) => (
              <span key={tag} className="premium-badge-tag" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "16px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text-primary)" }}>
                #{tag}
                <button type="button" className="remove-tag-btn" onClick={() => handleRemoveTag(tag)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "14px", padding: "0 2px", fontWeight: "bold" }}>×</button>
              </span>
            ))}
            {prefs.tagPreferences.length === 0 && (
              <p className="no-tags-msg" style={{ fontSize: "13px", color: "var(--text-secondary)", fontStyle: "italic", margin: "4px 0" }}>No tags followed. You will receive notifications for all categories.</p>
            )}
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`settings-toast ${message.type}`} style={{ margin: "16px 0", padding: "12px 16px", borderRadius: "8px", fontSize: "14px", backgroundColor: message.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: message.type === "success" ? "#10b981" : "#ef4444", border: `1px solid ${message.type === "success" ? "#10b981" : "#ef4444"}` }}>
          {message.text}
        </div>
      )}

      <div className="settings-footer" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="save-settings-btn"
          style={{ padding: "10px 20px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-color, #3b82f6)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1, transition: "opacity 0.2s" }}
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
