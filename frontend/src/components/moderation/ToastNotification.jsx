import { useEffect, useRef } from "react";

export default function ToastNotification({ toasts, onDismiss }) {
  return (
    <div className="mod-toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, 3500);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onDismiss]);

  const VARIANTS = {
    success: {
      iconBg: "rgba(34,197,94,0.15)",
      icon: "✅",
    },
    warning: {
      iconBg: "rgba(245,158,11,0.15)",
      icon: "⚠️",
    },
    error: {
      iconBg: "rgba(239,68,68,0.15)",
      icon: "❌",
    },
    info: {
      iconBg: "rgba(59,130,246,0.15)",
      icon: "ℹ️",
    },
  };

  const variant = VARIANTS[toast.type] || VARIANTS.info;

  return (
    <div className="mod-toast" role="alert">
      <div className="mod-toast-icon" style={{ background: variant.iconBg }}>
        {variant.icon}
      </div>
      <div className="mod-toast-content">
        <p className="mod-toast-title">{toast.title}</p>
        {toast.message && <p className="mod-toast-message">{toast.message}</p>}
      </div>
      <button
        className="mod-toast-dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
