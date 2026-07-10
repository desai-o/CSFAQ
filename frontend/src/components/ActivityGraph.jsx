import React, { useState, useEffect } from "react";
import { fetchActivityStats } from "../api/faqApi";
import { useTheme } from "../context/ThemeContext";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import "./ActivityGraph.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function ActivityGraph() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("questions"); // "questions", "answers", "upvotes"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const json = await fetchActivityStats("week");
        setData(json);
      } catch (err) {
        console.warn("API error, using client-side fallback data:", err);
        // Fallback mock data if API is not reachable
        setData({
          questions: [32, 45, 38, 52, 71, 29, 17],
          answers: [88, 120, 95, 140, 185, 72, 44],
          upvotes: [210, 340, 280, 420, 580, 190, 110],
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          meta: {
            peakDay: "Friday",
            weekTotal: 284,
            dailyAvg: 41,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="graph-card skeleton-loading">
        <div className="graph-header-skeleton" />
        <div className="graph-stats-skeleton" />
        <div className="graph-chart-skeleton" />
      </div>
    );
  }

  // Extract current tab metrics dynamically
  const labels = data.labels;
  let tabData = [];
  let tabColor = "#3b82f6"; // default blue
  let tabBgGlow = "rgba(59, 130, 246, 0.15)";

  if (activeTab === "questions") {
    tabData = data.questions;
    tabColor = theme === "dark" ? "#9ca3af" : "#6b7280";
    tabBgGlow = theme === "dark" ? "rgba(156, 163, 175, 0.15)" : "rgba(107, 114, 128, 0.15)";
  } else if (activeTab === "answers") {
    tabData = data.answers;
    tabColor = theme === "dark" ? "#4ade80" : "#22c55e";
    tabBgGlow = theme === "dark" ? "rgba(74, 222, 128, 0.15)" : "rgba(34, 197, 94, 0.15)";
  } else if (activeTab === "upvotes") {
    tabData = data.upvotes;
    tabColor = theme === "dark" ? "#60a5fa" : "#3b82f6";
    tabBgGlow = theme === "dark" ? "rgba(96, 165, 250, 0.15)" : "rgba(59, 130, 246, 0.15)";
  }

  // Calculate tab-specific indicators
  const weekTotal = tabData.reduce((acc, curr) => acc + curr, 0);
  const dailyAvg = Math.round(weekTotal / 7);

  let maxVal = -1;
  let peakIndex = 0;
  for (let i = 0; i < tabData.length; i++) {
    if (tabData[i] > maxVal) {
      maxVal = tabData[i];
      peakIndex = i;
    }
  }
  const peakDay = labels[peakIndex];

  // Chart configuration
  const gridColor = theme === "dark" ? "#333333" : "#e5e5e5";
  const textColor = theme === "dark" ? "#94a3b8" : "#666666";

  const chartData = {
    labels: labels,
    datasets: [
      {
        fill: true,
        label: activeTab.toUpperCase(),
        data: tabData,
        borderColor: tabColor,
        backgroundColor: tabBgGlow,
        borderWidth: 3,
        pointBackgroundColor: tabColor,
        pointBorderColor: theme === "dark" ? "#242424" : "#ffffff",
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: tabColor,
        pointHoverBorderColor: theme === "dark" ? "#242424" : "#ffffff",
        pointHoverBorderWidth: 2,
        tension: 0.35, // smooth curved line
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: theme === "dark" ? "#2a2a2a" : "#ffffff",
        titleColor: theme === "dark" ? "#f0f0f0" : "#111111",
        bodyColor: theme === "dark" ? "#999999" : "#666666",
        borderColor: gridColor,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => ` ${context.parsed.y} ${activeTab}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          font: {
            family: "DM Sans, sans-serif",
            size: 11,
            weight: 500,
          },
        },
      },
      y: {
        grid: {
          color: gridColor,
        },
        border: {
          dash: [5, 5],
        },
        ticks: {
          color: textColor,
          precision: 0,
          font: {
            family: "DM Sans, sans-serif",
            size: 11,
            weight: 500,
          },
        },
      },
    },
  };

  return (
    <div className="graph-card">
      {/* Accent Top Border is implemented via CSS */}
      <div className="graph-header">
        <div className="graph-title-group">
          <h3>Activity Analytics</h3>
          <p>Real-time community interactions and posting stats</p>
        </div>

        {/* Action Tabs */}
        <div className="graph-tabs">
          <button
            className={`graph-tab-btn tab-questions ${activeTab === "questions" ? "active" : ""}`}
            onClick={() => setActiveTab("questions")}
          >
            Questions
          </button>
          <button
            className={`graph-tab-btn tab-answers ${activeTab === "answers" ? "active" : ""}`}
            onClick={() => setActiveTab("answers")}
          >
            Answers
          </button>
          <button
            className={`graph-tab-btn tab-upvotes ${activeTab === "upvotes" ? "active" : ""}`}
            onClick={() => setActiveTab("upvotes")}
          >
            Upvotes
          </button>
        </div>
      </div>

      {/* Mini Stats Summary Row */}
      <div className="graph-stats-row">
        <div className="graph-stat-box">
          <span className="graph-stat-label">Peak Day</span>
          <span className="graph-stat-value">{peakDay}</span>
        </div>
        <div className="graph-stat-box">
          <span className="graph-stat-label">This Week Total</span>
          <span className="graph-stat-value">{weekTotal.toLocaleString()}</span>
        </div>
        <div className="graph-stat-box">
          <span className="graph-stat-label">Daily Avg</span>
          <span className="graph-stat-value">{dailyAvg.toLocaleString()}</span>
        </div>
      </div>

      {/* Line Chart Canvas Wrapper */}
      <div className="graph-chart-wrapper">
        <Line 
          data={chartData} 
          options={chartOptions} 
          role="img" 
          aria-label="Community Activity Graph" 
        />
      </div>
    </div>
  );
}

export default ActivityGraph;
