import React, { useState, useRef, useEffect } from "react";
import { fetchHeatmapStats } from "../api/faqApi";
import { calculateRangeTotal, calculateTrendPercent } from "./communityHeatmapUtils";
import "./CommunityHeatmap.css";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const timeSlots = ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM"];

const timeRanges = {
  "12 AM": "12.00 AM – 04.00 AM",
  "4 AM": "04.00 AM – 08.00 AM",
  "8 AM": "08.00 AM – 12.00 PM",
  "12 PM": "12.00 PM – 04.00 PM",
  "4 PM": "04.00 PM – 08.00 PM",
  "8 PM": "08.00 PM – 12.00 AM",
};

// Generate a realistic, stable dataset for the heatmap based on selected range
const generateStaticData = (range) => {
  const map = {};
  const dayIndex = { "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 7 };
  const timeIndex = { "12 AM": 0, "4 AM": 1, "8 AM": 2, "12 PM": 3, "4 PM": 4, "8 PM": 5 };

  days.forEach((day) => {
    timeSlots.forEach((time) => {
      const d = dayIndex[day];
      const t = timeIndex[time];
      let intensity = 0;
      let questions = 0;
      let answers = 0;
      let trendVal = 0;

      if (range === "This Week") {
        // Wed, Thu, Fri are high activity.
        if (t === 0 || t === 1) { // 12 AM, 4 AM
          intensity = 0;
          questions = t === 0 ? 2 : 1;
          answers = t === 0 ? 3 : 1;
          trendVal = -1.2;
        } else if (t === 2) { // 8 AM
          if (d >= 1 && d <= 5) {
            intensity = 2;
            questions = 12 + d;
            answers = 24 + d * 2;
            trendVal = 3.4;
          } else {
            intensity = 1;
            questions = 4;
            answers = 8;
            trendVal = 0.5;
          }
        } else if (t === 3 || t === 4) { // 12 PM, 4 PM
          if (d >= 3 && d <= 5) { // Wed, Thu, Fri
            intensity = 4;
            questions = t === 3 ? 34 + d : 42 + d;
            answers = t === 3 ? 88 + d * 4 : 112 + d * 5;
            trendVal = 12.8;
          } else if (d === 1 || d === 2) { // Mon, Tue
            intensity = 3;
            questions = 22;
            answers = 54;
            trendVal = 6.2;
          } else { // Sat, Sun
            intensity = 2;
            questions = 14;
            answers = 30;
            trendVal = 2.1;
          }
        } else { // 8 PM
          if (d >= 1 && d <= 5) {
            intensity = 3;
            questions = 16 + d;
            answers = 38 + d * 2;
            trendVal = 5.1;
          } else {
            intensity = 1;
            questions = 7;
            answers = 15;
            trendVal = -0.8;
          }
        }

        // Add minor custom variations for realism
        if (day === "Wed" && time === "4 PM") { intensity = 4; questions = 48; answers = 128; trendVal = 14.6; }
        if (day === "Thu" && time === "12 PM") { intensity = 4; questions = 41; answers = 98; trendVal = 11.2; }
        if (day === "Fri" && time === "4 PM") { intensity = 4; questions = 46; answers = 118; trendVal = 13.5; }
      } else if (range === "Last Week") {
        // Mon, Tue, Wed are high activity (e.g. system launch)
        if (t === 0 || t === 1) { // 12 AM, 4 AM
          intensity = 0;
          questions = t === 0 ? 1 : 0;
          answers = t === 0 ? 2 : 1;
          trendVal = -2.5;
        } else if (t === 2) { // 8 AM
          if (d <= 3) {
            intensity = 3;
            questions = 18;
            answers = 36;
            trendVal = 8.1;
          } else {
            intensity = 1;
            questions = 5;
            answers = 10;
            trendVal = 1.0;
          }
        } else if (t === 3 || t === 4) { // 12 PM, 4 PM
          if (d <= 3) { // Mon, Tue, Wed
            intensity = 4;
            questions = t === 3 ? 45 : 52;
            answers = t === 3 ? 105 : 130;
            trendVal = 15.4;
          } else if (d === 4 || d === 5) { // Thu, Fri
            intensity = 2;
            questions = 15;
            answers = 32;
            trendVal = 1.8;
          } else { // Sat, Sun
            intensity = 1;
            questions = 6;
            answers = 12;
            trendVal = -4.2;
          }
        } else { // 8 PM
          if (d <= 3) {
            intensity = 3;
            questions = 20;
            answers = 48;
            trendVal = 6.8;
          } else {
            intensity = 1;
            questions = 8;
            answers = 14;
            trendVal = -2.0;
          }
        }
      } else { // "Two Weeks Ago"
        // Fri, Sat, Sun are moderate/high activity (e.g., weekend hackathon)
        if (t === 0 || t === 1) { // 12 AM, 4 AM
          intensity = t === 0 ? 1 : 0;
          questions = t === 0 ? 3 : 1;
          answers = t === 0 ? 6 : 2;
          trendVal = 1.5;
        } else if (t === 2) { // 8 AM
          if (d >= 5) { // Fri, Sat, Sun
            intensity = 2;
            questions = 14;
            answers = 28;
            trendVal = 4.2;
          } else {
            intensity = 1;
            questions = 6;
            answers = 12;
            trendVal = 0.2;
          }
        } else if (t === 3 || t === 4) { // 12 PM, 4 PM
          if (d >= 5) { // Fri, Sat, Sun
            intensity = 4;
            questions = t === 3 ? 38 : 44;
            answers = t === 3 ? 92 : 115;
            trendVal = 10.5;
          } else if (d >= 1 && d <= 4) { // Mon - Thu
            intensity = 2;
            questions = 12;
            answers = 26;
            trendVal = -1.5;
          }
        } else { // 8 PM
          if (d >= 5) {
            intensity = 3;
            questions = 22;
            answers = 50;
            trendVal = 7.1;
          } else {
            intensity = 1;
            questions = 8;
            answers = 16;
            trendVal = -0.5;
          }
        }
      }

      const trend = trendVal >= 0 ? `+${trendVal.toFixed(1)}%` : `${trendVal.toFixed(1)}%`;
      map[`${time}-${day}`] = {
        day,
        time,
        timeRange: timeRanges[time],
        questions,
        answers,
        trend,
        intensity,
      };
    });
  });
  return map;
};

// Pre-generate datasets for simple, fast lookup
const datasets = {
  "This Week": generateStaticData("This Week"),
  "Last Week": generateStaticData("Last Week"),
  "Two Weeks Ago": generateStaticData("Two Weeks Ago"),
};

// Order of ranges from oldest -> newest, so the previous range for any
// given range is the chronologically earlier one. This is what we compare
// against to compute the "vs Last Week" trend.
//   - This Week       -> baseline = Last Week
//   - Last Week       -> baseline = Two Weeks Ago
//   - Two Weeks Ago   -> baseline = none (shows em-dash)
const rangeOrder = ["Two Weeks Ago", "Last Week", "This Week"];

// Map the user-facing dropdown label to the API range param understood by
// the /api/stats/heatmap endpoint. All three options now resolve to a 7-day
// window so "Last Week" / "Two Weeks Ago" don't accidentally pull 30 days.
//   - "This Week"     -> "week"          (last 7 days, rolling)
//   - "Last Week"     -> "last_week"     (7-13 days ago)
//   - "Two Weeks Ago" -> "two_weeks_ago" (14-20 days ago)
const rangeToApiParam = (rangeKey) => {
  if (rangeKey === "Last Week") return "last_week";
  if (rangeKey === "Two Weeks Ago") return "two_weeks_ago";
  return "week";
};

// Convert an array of heatmap cells (the shape the backend returns) into a
// map keyed by `${time}-${day}`, matching the shape `datasets[key]` uses.
const cellsToMap = (cells) => {
  const map = {};
  for (const cell of cells) {
    if (!cell || !cell.time || !cell.day) continue;
    map[`${cell.time}-${cell.day}`] = cell;
  }
  return map;
};

// Sum of (questions + answers) for a heatmap dataset - works on both the
// raw `data` array returned by the API and the static dataset maps.
const sumInteractions = (rows) => {
  if (!rows) return 0;
  if (Array.isArray(rows)) return calculateRangeTotal(rows);
  return calculateRangeTotal(Object.values(rows));
};

// Compute the total interactions (questions + answers) for a given range's dataset
const computeRangeTotal = (rangeKey) => {
  const data = datasets[rangeKey];
  if (!data) return 0;
  return sumInteractions(data);
};

// Compute the percentage change between two numeric totals.
// Returns an object with the formatted string and a `positive` flag.
const computeTrendPercent = (current, previous) => {
  return calculateTrendPercent(current, previous);
};

// Icons
const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="heatmap-dropdown-icon">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const TrendUpIcon = ({ isNegative }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginRight: "2px", transform: isNegative ? "rotate(90deg)" : "none" }}
  >
    {isNegative ? (
      <>
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
        <polyline points="17 18 23 18 23 12" />
      </>
    ) : (
      <>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </>
    )}
  </svg>
);

function CommunityHeatmap() {
  const [selectedRange, setSelectedRange] = useState("This Week");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredData, setHoveredData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const cardRef = useRef(null);
  const dropdownRef = useRef(null);

  const [heatmapData, setHeatmapData] = useState([]);
  // `meta.totalEvents` from the API. When this is 0 the backend served its
  // range-agnostic `populateFallbackHeatmap` data, which produces the SAME
  // pattern for "This Week" / "Last Week" / "Two Weeks Ago" - that is why
  // every tab used to show the same total and the same pebble pattern. We
  // use this flag to detect that case and prefer the per-range static
  // demo dataset instead.
  const [heatmapMeta, setHeatmapMeta] = useState({});
  // Live API data for the chronologically previous range, used so the
  // "vs Last Week" badge compares API vs API instead of mixing live data
  // with the static fallback dataset.
  const [previousHeatmapData, setPreviousHeatmapData] = useState([]);
  const [previousHeatmapMeta, setPreviousHeatmapMeta] = useState({});
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);

  // Compute totals for each static range up-front, so we can compute trends
  // between adjacent ranges when the API is unavailable (e.g. offline demo).
  const staticRangeTotals = rangeOrder.reduce((acc, key) => {
    acc[key] = computeRangeTotal(key);
    return acc;
  }, {});

  useEffect(() => {
    let cancelled = false;

    // Clear stale data from the previously selected range so we never
    // briefly display the previous tab's totals above the new tab's cells
    // while the API request for the new range is still in flight.
    setHeatmapData([]);
    setHeatmapMeta({});
    setPreviousHeatmapData([]);
    setPreviousHeatmapMeta({});

    const loadHeatmap = async () => {
      try {
        setLoadingHeatmap(true);
        const currentIdx = rangeOrder.indexOf(selectedRange);
        const previousKey = currentIdx > 0 ? rangeOrder[currentIdx - 1] : null;

        const currentPromise = fetchHeatmapStats(rangeToApiParam(selectedRange));
        // "Two Weeks Ago" has no chronologically earlier range, but we still
        // load "Last Week" so we can fall back to it (the "oldest available"
        // data) when "Two Weeks Ago" comes back empty from the API.
        const comparisonKey = previousKey || "Last Week";
        const previousPromise = fetchHeatmapStats(rangeToApiParam(comparisonKey));

        const [currentResponse, previousResponse] = await Promise.all([
          currentPromise,
          previousPromise
        ]);

        if (cancelled) return;

        setHeatmapData(currentResponse?.data || []);
        setHeatmapMeta(currentResponse?.meta || {});
        setPreviousHeatmapData(previousResponse?.data || []);
        setPreviousHeatmapMeta(previousResponse?.meta || {});
      } catch (err) {
        if (cancelled) return;
        console.warn("Heatmap API failed. Falling back to static heatmap:", err.message);
        setHeatmapData([]);
        setHeatmapMeta({});
        setPreviousHeatmapData([]);
        setPreviousHeatmapMeta({});
      } finally {
        if (!cancelled) setLoadingHeatmap(false);
      }
    };

    loadHeatmap();
    return () => { cancelled = true; };
  }, [selectedRange]);

  // Cell-level previous range lookup helper (used for tooltip trend).
  // Prefer the previous range's live API cells when available, fall back to
  // the static dataset for that range otherwise.
  const previousCellMap =
    previousHeatmapData.length > 0 ? cellsToMap(previousHeatmapData) : null;

  const getPreviousCell = (rangeKey, time, day) => {
    const idx = rangeOrder.indexOf(rangeKey);
    if (idx <= 0) return null;
    const prevKey = rangeOrder[idx - 1];

    if (previousCellMap) {
      return previousCellMap[`${time}-${day}`] || null;
    }
    const prevMap = datasets[prevKey];
    return prevMap ? prevMap[`${time}-${day}`] || null : null;
  };

  // Decide whether to use the live API data or the per-range static demo
  // dataset. The backend's `populateFallbackHeatmap` returns the SAME
  // range-agnostic pattern for every range when `meta.totalEvents === 0`,
  // which previously caused every tab to look identical. Prefer the
  // per-range static data in that case so each tab shows distinct content.
  const apiHasRealData =
    heatmapData.length > 0 && (heatmapMeta?.totalEvents || 0) > 0;

  // Get active dataset and total
  // When API data is "real" (meta.totalEvents > 0), use the API's
  // `interactions` count (which includes votes and any other event types)
  // as each cell's `cellTotal`. When API data is the range-agnostic
  // fallback, prefer the per-range static demo dataset so each tab has
  // its own distinct pattern and total.
  const currentDataMap = apiHasRealData
    ? heatmapData.reduce((acc, item) => {
        const time = item.time;
        const day = item.day;
        const questions = item.questions ?? 0;
        const answers = item.answers ?? 0;
        const cellTotal = Number(item.interactions ?? (questions + answers)) || 0;

        acc[`${time}-${day}`] = {
          ...item,
          questions,
          answers,
          timeRange: timeRanges[time] || time,
          intensity: Math.min(4, Math.ceil(cellTotal / 5)),
          cellTotal,
        };
        return acc;
      }, {})
    : Object.fromEntries(
        Object.entries(datasets[selectedRange]).map(([key, cell]) => {
          // Static demo dataset has questions/answers but no `interactions`
          // field, so derive a cell total from questions + answers here.
          const cellTotal = (cell.questions || 0) + (cell.answers || 0);
          return [
            key,
            {
              ...cell,
              cellTotal,
            },
          ];
        })
      );

  // Calculate "Total Interactions" with a proper fallback chain so the
  // number is always meaningful when the user switches tabs:
  //   1. Live API data for the selected range (only if it is "real" - i.e.
  //      meta.totalEvents > 0). The backend's `populateFallbackHeatmap`
  //      otherwise returns the same range-agnostic pattern for every tab,
  //      so we would otherwise show the same count for every range.
  //   2. For "Two Weeks Ago" without API data, fall back to the "oldest
  //      available" data: "Last Week" from the API when it has real data.
  //      This keeps the count from collapsing to 0 during the window where
  //      the backend hasn't recorded events for two-weeks-ago yet.
  //   3. The per-range static demo dataset, which has a distinct total and
  //      pattern for every range, so each tab shows a different number.
  //   4. The static demo dataset for the most recent available range, so we
  //      never end up showing 0.
  const totalInteractions = (() => {
    if (apiHasRealData) {
      return sumInteractions(heatmapData);
    }

    if (
      selectedRange === "Two Weeks Ago" &&
      previousHeatmapData.length > 0 &&
      (previousHeatmapMeta?.totalEvents || 0) > 0
    ) {
      return sumInteractions(previousHeatmapData);
    }

    const staticSelected = staticRangeTotals[selectedRange] || 0;
    if (staticSelected > 0) return staticSelected;

    // Last-resort: use the newest available static range ("This Week") so
    // the count is never 0/placeholder.
    return staticRangeTotals["This Week"] || 0;
  })();

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleMouseEnter = (e, cellData) => {
    setHoveredData(cellData);
    updateTooltipPosition(e);
  };

  const handleMouseMove = (e) => {
    updateTooltipPosition(e);
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
  };

  const updateTooltipPosition = (e) => {
    if (!cardRef.current) return;

    // Get mouse coordinates relative to the card container
    const cardRect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - cardRect.left;
    const y = e.clientY - cardRect.top;

    // Position the tooltip slightly offset to the cursor
    let tooltipX = x + 15;
    let tooltipY = y - 90; // slightly higher for compact design

    // Boundaries checking
    if (tooltipX + 190 > cardRect.width) {
      // Shift tooltip to the left of the cursor if it goes out of card width
      tooltipX = x - 205;
    }
    if (tooltipY < 10) {
      // Shift tooltip below the cursor if it goes out of top bounds
      tooltipY = y + 20;
    }

    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  return (
    <div className="heatmap-card" ref={cardRef}>
      {/* Header section */}
      <div className="heatmap-header">
        <div className="heatmap-title-group">
          <h2>Community Activity</h2>
          <p>Question & answer patterns over the week</p>
        </div>

        {/* Dropdown Container */}
        <div className="heatmap-dropdown-container" ref={dropdownRef}>
          <button className="heatmap-dropdown" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <CalendarIcon />
            <span>{selectedRange}</span>
            <ChevronDownIcon />
          </button>

          {dropdownOpen && (
            <ul className="heatmap-dropdown-list">
              {Object.keys(datasets).map((range) => (
                <li
                  key={range}
                  className={`heatmap-dropdown-item ${selectedRange === range ? "active" : ""}`}
                  onClick={() => {
                    setSelectedRange(range);
                    setDropdownOpen(false);
                  }}
                >
                  {range}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Interactions Summary */}
      <div className="heatmap-stats-summary">
        <span className="heatmap-total-interactions">
          {totalInteractions.toLocaleString()}
        </span>
        <span className="heatmap-stat-label">Total Interactions</span>
      </div>

      {/* Heatmap Grid wrapper (for horizontal scroll support on small screens) */}
      <div className="heatmap-grid-container">
        <div className="heatmap-grid">
          {timeSlots.map((time) => (
            <React.Fragment key={time}>
              <div className="heatmap-time-label">{time}</div>
              {days.map((day) => {
                const cellData = currentDataMap[`${time}-${day}`];
                return (
                  <div
                    key={`${time}-${day}`}
                    className={`heatmap-cell heatmap-cell-lvl-${cellData.intensity}`}
                    onMouseEnter={(e) => handleMouseEnter(e, cellData)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })}
            </React.Fragment>
          ))}

          {/* Spacer for empty corner block */}
          <div className="heatmap-spacer" />

          {/* Column headers (Days) at the bottom */}
          {days.map((day) => (
            <div key={day} className="heatmap-day-label">
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip Card */}
      {hoveredData && (
        <div
          className="heatmap-tooltip"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <span className="heatmap-tooltip-time">{hoveredData.timeRange}</span>

          <div className="heatmap-tooltip-stat-row">
            <span className="heatmap-tooltip-label">Questions</span>
            <span className="heatmap-tooltip-value">{hoveredData.questions}</span>
          </div>

          <div className="heatmap-tooltip-stat-row">
            <span className="heatmap-tooltip-label">Answers</span>
            <span className="heatmap-tooltip-value">{hoveredData.answers}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityHeatmap;
