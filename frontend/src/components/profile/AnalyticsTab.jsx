import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

const analyticsData = [
  { label: "Profile Views",          value: "1.8K", change: "18%", points: "0,22 12,18 24,20 36,12 48,16 60,8 72,12 84,6"  },
  { label: "FAQ Views",              value: "9.6K", change: "24%", points: "0,20 12,14 24,18 36,8 48,13 60,5 72,9 84,3"    },
  { label: "Search Appearances",     value: "3.2K", change: "12%", points: "0,20 12,16 24,12 36,17 48,10 60,14 72,7 84,11" },
  { label: "Answer Acceptance Rate", value: "87%",  change: "8%",  points: "0,20 12,15 24,18 36,10 48,14 60,7 72,11 84,5"  },
];

const contentPerformance = [
  { label: "FAQs Created",           value: 128,    barPct: 62, color: "#2563EB" },
  { label: "FAQs Edited",            value: 215,    barPct: 40, color: "#16a34a" },
  { label: "Answers Submitted",      value: 342,    barPct: 78, color: "#D97706" },
  { label: "Comments Added",         value: 186,    barPct: 32, color: "#7C3AED" },
  { label: "Helpful Votes Received", value: "1.2K", barPct: 90, color: "#94a3b8" },
];

const audienceData = [
  { label: "Total Visitors",       value: "12.4K", change: "16%", isClock: false },
  { label: "Returning Visitors",   value: "3.6K",  change: "12%", isClock: false },
  { label: "Avg. Time on Profile", value: "2m 34s",change: "8%",  isClock: true  },
];

const Sparkline = ({ points }) => (
  <svg viewBox="0 0 84 28" fill="none"
    style={{ width: "100%", height: 40, display: "block", marginTop: 8 }}>
    <polyline points={points} stroke="#2563EB" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconPerson = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

// ─── Views Over Time — statistical with data points ───────────────────────────
function ViewsOverTimeChart() {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy();

    const labels = [
      "Apr 26","Apr 27","Apr 28","Apr 29","Apr 30",
      "May 1","May 2","May 3","May 4","May 5","May 6","May 7","May 8",
      "May 9","May 10","May 11","May 12","May 13","May 14","May 15",
      "May 16","May 17","May 18","May 19","May 20","May 21","May 22",
      "May 23","May 24",
    ];

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Profile Views",
            data: [1200,1380,1750,1600,1820,1540,1480,1650,1500,1580,1420,1700,1550,1480,1600,1750,1520,1680,1900,1750,1820,1760,1850,1780,1900,1840,1780,1650,1950],
            borderColor: "#2563EB",
            backgroundColor: "rgba(37,99,235,0.06)",
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#2563EB",
            pointBorderColor: "#fff",
            pointBorderWidth: 1.5,
            tension: 0.35,
            fill: false,
          },
          {
            label: "FAQ Views",
            data: [780,920,1180,1050,1220,980,900,1050,980,1020,880,1100,950,900,1000,1100,920,1050,1180,1020,1100,1060,1120,1040,1150,1080,1020,940,1080],
            borderColor: "#16a34a",
            backgroundColor: "rgba(22,163,74,0.06)",
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#16a34a",
            pointBorderColor: "#fff",
            pointBorderWidth: 1.5,
            tension: 0.35,
            fill: false,
          },
          {
            label: "Search Appearances",
            data: [480,510,590,540,620,500,470,530,490,510,460,560,490,460,510,570,480,540,610,520,570,540,580,530,600,560,510,480,630],
            borderColor: "#D97706",
            backgroundColor: "rgba(217,119,6,0.06)",
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#D97706",
            pointBorderColor: "#fff",
            pointBorderWidth: 1.5,
            tension: 0.35,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#fff",
            borderColor: "#e2e8f0",
            borderWidth: 1,
            titleColor: "#0f172a",
            bodyColor: "#64748b",
            padding: 10,
            boxPadding: 4,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              maxTicksLimit: 8,
              maxRotation: 0,
            },
          },
          y: {
            grid: { color: "#f1f5f9" },
            border: { display: false },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              callback: v => v >= 1000 ? v / 1000 + "K" : v,
              maxTicksLimit: 5,
            },
            min: 0,
            max: 2500,
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, []);

  return (
    <div style={{ ...c.card, flex: 1, display:"flex", flexDirection:"column" }}>
      <div style={c.cardHead}>
        <span style={c.cardTitle}>Views Over Time</span>
        <div style={c.dropdown}>Last 30 days <ChevronDown /></div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        {[["#2563EB","Profile Views"],["#16a34a","FAQ Views"],["#D97706","Search Appearances"]].map(([color, label]) => (
          <span key={label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#6b7280" }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />
            {label}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 200 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// ─── Analytics Overview only (for Overview tab) ───────────────────────────────
export function AnalyticsOverview() {
  return (
    <div style={c.card}>
      <div style={c.cardHead}>
        <span style={c.cardTitle}>Analytics Overview</span>
        <div style={c.dropdown}>Last 30 days <ChevronDown /></div>
      </div>
      <div style={c.overviewGrid}>
        {analyticsData.map((a, i) => (
          <div key={a.label} style={{ ...c.overviewBox, borderRight: i < 3 ? "1px solid #e5e7eb" : "none" }}>
            <span style={c.ovLabel}>{a.label}</span>
            <strong style={c.ovValue}>{a.value}</strong>
            <span style={c.ovChange}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight:2 }}>
                <polyline points="18 15 12 9 6 15" />
              </svg>
              {a.change}
            </span>
            <Sparkline points={a.points} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full Analytics Tab ───────────────────────────────────────────────────────
export default function Analytics() {
  return (
    <div style={c.layout}>

      {/* LEFT */}
      <div style={c.leftCol}>
        <div style={c.card}>
          <div style={c.cardHead}>
            <span style={c.cardTitle}>Analytics Overview</span>
            <div style={c.dropdown}>Last 30 days <ChevronDown /></div>
          </div>
          <div style={c.overviewGrid}>
            {analyticsData.map((a, i) => (
              <div key={a.label} style={{ ...c.overviewBox, borderRight: i < 3 ? "1px solid #e5e7eb" : "none" }}>
                <span style={c.ovLabel}>{a.label}</span>
                <strong style={c.ovValue}>{a.value}</strong>
                <span style={c.ovChange}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight:2 }}>
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  {a.change}
                </span>
                <Sparkline points={a.points} />
              </div>
            ))}
          </div>
        </div>

        <ViewsOverTimeChart />
      </div>

      {/* RIGHT */}
    <div style={c.rightCol}>

      {/* Top FAQ */}
      <div style={c.card}>
        <div style={c.cardHead}>
          <span style={c.cardTitle}>
            Top FAQ <span style={{ fontWeight:400, color:"#6b7280", fontSize:13 }}>(by views)</span>
          </span>
          <button style={c.viewAll}>View all</button>
        </div>
        <div style={c.faqRow}>
          <div style={c.faqIconBox}><IconFile /></div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#111827" }}>API Authentication Guide</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>Your most viewed FAQ</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#111827" }}>2.5K</div>
            <div style={{ fontSize:11, color:"#6b7280" }}>Views</div>
          </div>
        </div>
      </div>

      {/* Content Performance */}
      <div style={c.card}>
        <div style={c.cardHead}>
          <span style={c.cardTitle}>Content Performance</span>
          <button style={c.viewAll}>View all</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {contentPerformance.map((item) => (
            <div key={item.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={c.cpLabel}>{item.label}</span>
              <span style={c.cpVal}>{item.value}</span>
              <div style={c.cpBarWrap}>
                <div style={{ ...c.cpBar, width:`${item.barPct}%`, background:item.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audience Engagement — now its own separate card */}
      <div style={c.card}>
        <div style={c.cardHead}>
          <span style={c.cardTitle}>Audience Engagement</span>
          <button style={c.viewAll}>View all</button>
        </div>
        <div>
          {audienceData.map((item, i) => (
            <div key={i} style={{ ...c.audRow, borderBottom: i < audienceData.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <span style={c.audIcon}>{item.isClock ? <IconClock /> : <IconPerson />}</span>
              <span style={c.audLabel}>{item.label}</span>
              <span style={c.audVal}>{item.value}</span>
              <span style={c.audChange}>↑ {item.change}</span>
            </div>
          ))}
        </div>
      </div>

</div>
    </div>
  );
}

const c = {
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: 20,
    padding: 20,
    alignItems: "stretch",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  leftCol: { display:"flex", flexDirection:"column", gap:16, height:"100%" },
  rightCol: { display:"flex", flexDirection:"column", gap:16 },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "16px 18px",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: { fontSize:14, fontWeight:600, color:"#111827" },
  dropdown: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#374151",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "4px 10px",
    cursor: "pointer",
    userSelect: "none",
  },
  viewAll: {
    fontSize:12, color:"#2563eb",
    background:"none", border:"none", cursor:"pointer", padding:0,
    fontFamily:"inherit",
  },
  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  overviewBox: {
    display: "flex",
    flexDirection: "column",
    padding: "14px 16px",
    background: "#ffffff",
  },
  ovLabel:  { fontSize:11, color:"#6b7280", marginBottom:6 },
  ovValue:  { fontSize:22, fontWeight:600, color:"#111827", lineHeight:1.1 },
  ovChange: { display:"flex", alignItems:"center", fontSize:12, color:"#16a34a", marginTop:4 },

  faqRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#f9fafb",
    borderRadius: 8,
    padding: "10px 12px",
  },
  faqIconBox: {
    width:32, height:32,
    background:"#fff", border:"1px solid #e5e7eb", borderRadius:6,
    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
  },

  cpLabel:   { fontSize:12, color:"#6b7280", width:148, flexShrink:0 },
  cpVal:     { fontSize:12, color:"#111827", width:34, flexShrink:0 },
  cpBarWrap: { flex:1, height:4, background:"#f1f5f9", borderRadius:99, overflow:"hidden" },
  cpBar:     { height:"100%", borderRadius:99, transition:"width 0.4s ease" },

  audRow:   { display:"flex", alignItems:"center", gap:8, padding:"10px 0" },
  audIcon:  { width:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  audLabel: { flex:1, fontSize:13, color:"#374151" },
  audVal:   { fontSize:13, fontWeight:600, color:"#111827" },
  audChange:{ fontSize:12, color:"#16a34a", fontWeight:500, marginLeft:6 },
};