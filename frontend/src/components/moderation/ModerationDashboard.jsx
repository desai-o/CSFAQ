import { useState, useEffect, useCallback, useRef } from "react";
import "./moderation.css";
import {
  INITIAL_MOCK_ITEMS,
  computeMetrics,
  applyFilters,
} from "./mockModerationData";
import ModerationFilters from "./ModerationFilters";
import ModerationQueue from "./ModerationQueue";
import ReviewDetailsPanel from "./ReviewDetailsPanel";
import ConfirmationModal from "./ConfirmationModal";
import ToastNotification from "./ToastNotification";

const DEFAULT_FILTERS = {
  search: "",
  type: "all",
  status: "all",
  category: "all",
  sort: "most_recent",
};

const TOAST_MESSAGES = {
  approve: {
    type: "success",
    title: "Content Approved",
    message: "The item has been approved and published.",
  },
  reject: {
    type: "error",
    title: "Content Rejected",
    message: "The item has been rejected and removed from the queue.",
  },
  escalate: {
    type: "warning",
    title: "Content Escalated",
    message: "The item has been escalated for senior review.",
  },
  flag: {
    type: "info",
    title: "Flagged for Review",
    message: "The item has been flagged and is awaiting review.",
  },
};

let toastIdCounter = 0;

export default function ModerationDashboard() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: null,
    itemId: null,
  });
  const didMount = useRef(false);

  // Simulate initial load delay
  function loadData(withError = false) {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setTimeout(() => {
      if (withError) {
        setError(
          "Failed to load moderation queue. Please check your connection and try again."
        );
        setItems([]);
      } else {
        setItems(INITIAL_MOCK_ITEMS.map((item) => ({ ...item })));
        setError(null);
      }
      setLoading(false);
    }, 1400);
  }

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      loadData(false);
    }
  }, []);

  // Derived state
  const filteredItems = applyFilters(items, filters);
  const metrics = computeMetrics(items);
  const selectedItem = items.find((i) => i.id === selectedId) || null;

  // Toast helpers
  const addToast = useCallback((type, title, message) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Action handler — routes to confirmation or direct
  function handleAction(itemId, action) {
    if (action === "reject" || action === "escalate") {
      setConfirmModal({ open: true, action, itemId });
    } else {
      applyAction(itemId, action, "");
    }
  }

  function applyAction(itemId, action, reason) {
    const timestamp = new Date().toISOString();
    const historyEntry = {
      action,
      moderator: "You (Moderator)",
      reason: reason || null,
      timestamp,
    };

    const newStatus = {
      approve: "approved",
      reject: "rejected",
      escalate: "escalated",
      flag: "escalated",
    }[action];

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          status: newStatus,
          moderationHistory: [...item.moderationHistory, historyEntry],
        };
      })
    );

    // If the actioned item was selected and it leaves pending, we can keep it selected
    // so the moderator sees the updated history in the panel

    const toastConfig = TOAST_MESSAGES[action];
    if (toastConfig) {
      addToast(toastConfig.type, toastConfig.title, toastConfig.message);
    }
  }

  function handleConfirmModal(reason) {
    const { action, itemId } = confirmModal;
    setConfirmModal({ open: false, action: null, itemId: null });
    applyAction(itemId, action, reason);
  }

  function handleCancelModal() {
    setConfirmModal({ open: false, action: null, itemId: null });
  }

  function handleSaveNote(itemId, note) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, notes: note } : item
      )
    );
    addToast("success", "Note Saved", "Your moderator note has been saved.");
  }

  function handleRetry() {
    loadData(false);
  }

  function handleSelectItem(id) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  const METRIC_CARDS = [
    {
      key: "totalPending",
      label: "Pending Review",
      icon: "⏳",
      iconBg: "rgba(245,158,11,0.12)",
      className: "",
    },
    {
      key: "totalFlagged",
      label: "Flagged",
      icon: "⚑",
      iconBg: "rgba(239,68,68,0.12)",
      className: "",
    },
    {
      key: "totalApproved",
      label: "Approved",
      icon: "✅",
      iconBg: "rgba(34,197,94,0.12)",
      className: "",
    },
    {
      key: "totalRejected",
      label: "Rejected",
      icon: "❌",
      iconBg: "rgba(239,68,68,0.08)",
      className: "",
    },
    {
      key: "urgentCount",
      label: "Urgent Attention",
      icon: "🔥",
      iconBg: "rgba(239,68,68,0.15)",
      className: "urgent",
    },
  ];

  return (
    <div className="mod-dashboard">
      {/* ── Header row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 800,
              fontFamily: "var(--font-heading)",
            }}
          >
            Content Review Dashboard
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13.5px",
              color: "var(--text-secondary)",
            }}
          >
            Review, approve, reject, and escalate community-submitted content.
            All actions update local state only.
          </p>
        </div>

        {/* Dev controls for testing states */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            id="mod-simulate-error-btn"
            onClick={() => {
              loadData(true);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              background: "rgba(239,68,68,0.1)",
              color: "var(--accent-red)",
              border: "1px solid rgba(239,68,68,0.2)",
              cursor: "pointer",
              fontFamily: "var(--font-main)",
            }}
          >
            ⚠ Simulate Error
          </button>
          <button
            id="mod-reload-btn"
            onClick={() => loadData(false)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              background: "var(--bg-page)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              fontFamily: "var(--font-main)",
            }}
          >
            ↻ Reload Mock Data
          </button>
        </div>
      </div>

      {/* ── Metrics grid ── */}
      {!loading && !error && (
        <div className="mod-metrics-grid">
          {METRIC_CARDS.map((card) => (
            <div
              key={card.key}
              className={`mod-metric-card ${card.className}`}
              id={`mod-metric-${card.key}`}
            >
              <div className="mod-metric-icon" style={{ background: card.iconBg }}>
                {card.icon}
              </div>
              <div className="mod-metric-label">{card.label}</div>
              <div className="mod-metric-value">{metrics[card.key]}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading placeholder for metrics */}
      {loading && (
        <div className="mod-metrics-grid">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="mod-metric-card">
              <div
                className="mod-skeleton-line"
                style={{ width: "36px", height: "36px", borderRadius: "10px" }}
              />
              <div className="mod-skeleton-line" style={{ width: "80%", height: "12px" }} />
              <div className="mod-skeleton-line" style={{ width: "50%", height: "28px" }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      {!loading && !error && (
        <ModerationFilters
          filters={filters}
          onChange={setFilters}
          totalCount={items.length}
          filteredCount={filteredItems.length}
        />
      )}

      {/* ── Main content layout ── */}
      <div className="mod-content-layout">
        {/* Queue */}
        <div>
          <ModerationQueue
            items={filteredItems}
            selectedId={selectedId}
            onSelect={handleSelectItem}
            onAction={handleAction}
            loading={loading}
            error={error}
            onRetry={handleRetry}
          />
        </div>

        {/* Details panel */}
        {!loading && !error && (
          <ReviewDetailsPanel
            item={selectedItem}
            onAction={handleAction}
            onClose={() => setSelectedId(null)}
            onSaveNote={handleSaveNote}
          />
        )}
      </div>

      {/* ── Confirmation modal ── */}
      <ConfirmationModal
        open={confirmModal.open}
        action={confirmModal.action}
        item={items.find((i) => i.id === confirmModal.itemId) || null}
        onConfirm={handleConfirmModal}
        onCancel={handleCancelModal}
      />

      {/* ── Toast notifications ── */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
