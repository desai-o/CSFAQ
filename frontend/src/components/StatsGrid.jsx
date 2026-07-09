import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOverviewStats } from "../api/faqApi";

const POLL_INTERVAL_MS = 30000;

const statConfig = [
  {
    label: "Questions Asked",
    key: "questionsAsked",
  },
  {
    label: "Active Members",
    key: "activeMembers",
  },
  {
    label: "Answers Posted",
    key: "answersPosted",
  },
];

function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  }

  return String(value);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(timestamp).toLocaleTimeString();
}

function StatsGrid() {
  // Note: previously this component derived `answersPosted`, `questionsAsked`,
  // and `activeMembers` from the local `questions` array as a fallback. That
  // was incorrect because the local array can contain stale mock data
  // (`initialQuestions` in FAQContext) or pending optimistic updates, so the
  // stat card would briefly show a non-zero count after actions like an
  // upvote (which mutate the local questions array), and then snap back to
  // the backend's value on reload. The backend's `/stats/overview` endpoint
  // is the single source of truth, so we now rely on it exclusively and show
  // a loading state while it is in flight.
  const [stats, setStats] = useState({
    questionsAsked: 0,
    activeMembers: 0,
    answersPosted: 0,
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const isMountedRef = useRef(true);

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    try {
      const response = await fetchOverviewStats();
      if (!isMountedRef.current) return;

      if (response?.data) {
        setStats({
          questionsAsked: Number(response.data.questionsAsked) || 0,
          activeMembers: Number(response.data.activeMembers) || 0,
          answersPosted: Number(response.data.answersPosted) || 0,
        });
        setLastUpdated(Date.now());
        setError(null);
      }
    } catch (err) {
      console.warn("Failed to load overview stats", err);
      if (isMountedRef.current) {
        setError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    fetchStats();

    const intervalId = setInterval(() => {
      fetchStats({ silent: true });
    }, POLL_INTERVAL_MS);

    const handleRefreshEvent = () => {
      fetchStats({ silent: true });
    };

    const handleFocus = () => {
      fetchStats({ silent: true });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchStats({ silent: true });
      }
    };

    window.addEventListener("stats:refresh", handleRefreshEvent);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // Re-render every 15s so the "Updated Xs ago" label stays accurate.
    const labelIntervalId = setInterval(() => setTick((t) => t + 1), 15000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      clearInterval(labelIntervalId);
      window.removeEventListener("stats:refresh", handleRefreshEvent);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchStats]);

  // Reference tick so linter doesn't strip the re-render interval.
  void tick;
  void error;

  return (
    <div className="stats-panel-wrapper">
      <div className="stats-panel-meta">
        <span className="stats-updated-label" aria-live="polite">
          {loading
            ? "Loading latest data…"
            : lastUpdated
              ? `Updated ${formatRelativeTime(lastUpdated)}`
              : ""}
        </span>
      </div>

      <div className="stats-grid">
        {statConfig.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-number">
              {loading && stats[stat.key] === 0 ? "—" : formatValue(stats[stat.key])}
            </div>

            <div className="stat-label">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatsGrid;
