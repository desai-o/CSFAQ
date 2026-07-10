import { useEffect, useRef, useState } from "react";

export default function ConfirmationModal({ open, action, item, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const overlayRef = useRef(null);
  const firstFocusRef = useRef(null);

  // Reset reason when modal opens
  useEffect(() => {
    if (open) {
      setReason("");
      setTimeout(() => firstFocusRef.current?.focus(), 50);
    }
  }, [open, action]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open || !item) return null;

  const ACTION_CONFIG = {
    reject: {
      icon: "🗑️",
      iconBg: "rgba(239,68,68,0.12)",
      title: "Reject Content",
      desc: "This action will mark the content as rejected and remove it from the active queue. The author may be notified.",
      confirmLabel: "Confirm Rejection",
      confirmColor: "#ef4444",
    },
    escalate: {
      icon: "🔺",
      iconBg: "rgba(139,92,246,0.12)",
      title: "Escalate for Senior Review",
      desc: "This action will escalate the content to a senior moderator for further review. The item will remain visible but be flagged.",
      confirmLabel: "Confirm Escalation",
      confirmColor: "#8b5cf6",
    },
  };

  const config = ACTION_CONFIG[action] || ACTION_CONFIG.reject;

  function handleBackdropClick(e) {
    if (e.target === overlayRef.current) onCancel();
  }

  function handleConfirm() {
    onConfirm(reason.trim());
    setReason("");
  }

  return (
    <div
      className="mod-modal-overlay"
      ref={overlayRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mod-modal-title"
    >
      <div className="mod-confirm-modal">
        {/* Icon */}
        <div>
          <div className="mod-modal-icon" style={{ background: config.iconBg }}>
            {config.icon}
          </div>
        </div>

        {/* Text */}
        <div>
          <h2 className="mod-modal-title" id="mod-modal-title">
            {config.title}
          </h2>
          <p className="mod-modal-desc">{config.desc}</p>
        </div>

        {/* Content preview */}
        <div>
          <div className="mod-modal-reason-label">Content being actioned:</div>
          <div className="mod-modal-content-preview">
            "{item.body}"
          </div>
        </div>

        {/* Reason textarea */}
        <div>
          <div className="mod-modal-reason-label">
            Reason for this action{" "}
            <span style={{ fontWeight: 400, fontSize: "11px" }}>(optional)</span>
          </div>
          <textarea
            ref={firstFocusRef}
            className="mod-modal-reason-textarea"
            placeholder={
              action === "reject"
                ? "e.g. Confirmed spam — links to external commercial site"
                : "e.g. Requires legal expert review before publishing"
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="mod-modal-actions">
          <button
            className="mod-modal-cancel"
            onClick={onCancel}
            id="mod-modal-cancel-btn"
          >
            Cancel
          </button>
          <button
            className="mod-modal-confirm"
            style={{ background: config.confirmColor }}
            onClick={handleConfirm}
            id="mod-modal-confirm-btn"
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
