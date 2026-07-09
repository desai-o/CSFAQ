import { useEffect, useState } from "react";
import {
  fetchAdminOverview,
  fetchPendingQueries,
  fetchKnowledgeGaps,
  previewFaqImport,
  confirmFaqImport,
  downloadFaqExport
} from "../api/faqApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AskQuestionModal from "../components/AskQuestionModal";
import ModerationDashboard from "../components/moderation/ModerationDashboard";
import BulkPostingPanel from "../components/moderation/BulkPostingPanel";
import BulkEditPanel from "../components/moderation/BulkEditPanel";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [overview, setOverview] = useState(null);
  const [pendingQueries, setPendingQueries] = useState([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState({ failedSearches: [], unansweredQueries: [], staleFAQs: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportMode, setExportMode] = useState("raw");
  const [importFileName, setImportFileName] = useState("");
  const [importFileContent, setImportFileContent] = useState("");
  const [importPreview, setImportPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");

  // Helper: produce a stable unique id for editable preview rows
  const makePreviewId = () => `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Normalise backend preview payload into editable rows (every row is one FAQ)
  const normalisePreviewRows = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: item.id || makePreviewId(),
      question: item.question || "",
      answer: item.answer || "",
      category: item.category || "General",
      tags: Array.isArray(item.tags) ? item.tags : [],
      validationErrors: Array.isArray(item.validationErrors) ? item.validationErrors : [],
      duplicateScores: Array.isArray(item.duplicateScores) ? item.duplicateScores : []
    }));
  };

  const updatePreviewRow = (id, patch) => {
    setImportPreview((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const removePreviewRow = (id) => {
    setImportPreview((prev) => prev.filter((row) => row.id !== id));
  };

  const addPreviewRow = (init = {}) => {
    setImportPreview((prev) => [
      ...prev,
      {
        id: makePreviewId(),
        question: init.question || "",
        answer: init.answer || "",
        category: init.category || "General",
        tags: Array.isArray(init.tags) ? init.tags : [],
        validationErrors: [],
        duplicateScores: []
      }
    ]);
  };

  // Split a row's body into two at the nearest paragraph/sentence boundary.
  // Used when the AI returned one giant FAQ — lets the admin break it up.
  const splitPreviewRow = (id) => {
    setImportPreview((prev) => {
      const idx = prev.findIndex((row) => row.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const text = original.answer || "";

      let splitAt = -1;
      const paragraphMatches = [...text.matchAll(/\n\s*\n/g)];
      if (paragraphMatches.length > 0) {
        const mid = Math.floor(paragraphMatches.length / 2);
        splitAt = paragraphMatches[mid].index + paragraphMatches[mid][0].length;
      } else {
        const sentenceMatches = [...text.matchAll(/(?<=[.!?])\s+(?=[A-Z0-9])/g)];
        if (sentenceMatches.length > 0) {
          const mid = Math.floor(sentenceMatches.length / 2);
          splitAt = sentenceMatches[mid].index + sentenceMatches[mid][0].length;
        }
      }

      if (splitAt === -1 || splitAt >= text.length - 1) {
        return prev;
      }

      const firstHalf = text.slice(0, splitAt).trim();
      const secondHalf = text.slice(splitAt).trim();

      const updatedOriginal = { ...original, answer: firstHalf };
      const newRow = {
        id: makePreviewId(),
        question: original.question,
        answer: secondHalf,
        category: original.category || "General",
        tags: Array.isArray(original.tags) ? [...original.tags] : [],
        validationErrors: [],
        duplicateScores: []
      };

      const next = [...prev];
      next.splice(idx, 1, updatedOriginal, newRow);
      return next;
    });
  };

  async function loadAdminData() {
    setLoading(true);
    setError("");
    try {
      const overviewResponse = await fetchAdminOverview();
      const pendingResponse = await fetchPendingQueries();
      const gapsResponse = await fetchKnowledgeGaps();

      setOverview(overviewResponse.data);
      setPendingQueries(pendingResponse.data || []);
      setKnowledgeGaps(gapsResponse.data || { failedSearches: [], unansweredQueries: [], staleFAQs: [] });
    } catch (err) {
      setError(err.message || "Failed to load admin console data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleExport = async () => {
    setError("");
    try {
      const blob = await downloadFaqExport(exportFormat, exportMode);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `faqs.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Export failed.");
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportPreview([]);
    setImportStatus("");
    setImportError("");

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      setImportFileContent(result.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  };

  const handlePreviewImport = async () => {
    if (!importFileName || !importFileContent) {
      setImportError("Please select a PDF, DOCX, or TXT document to preview.");
      return;
    }

    setImportLoading(true);
    setImportError("");
    setImportPreview([]);
    setImportStatus("");

    try {
      const response = await previewFaqImport(importFileName, importFileContent);
      const rows = normalisePreviewRows(response.data || []);
      setImportPreview(rows);
      if (rows.length === 0) {
        setImportStatus("No candidate FAQs were generated from this document.");
      } else {
        setImportStatus(`Preview generated ${rows.length} FAQ candidate${rows.length === 1 ? "" : "s"}. Edit titles, split bodies, or add more rows before confirming.`);
      }
    } catch (err) {
      setImportError(err.message || "Preview failed.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview.length) {
      setImportError("No preview items available for import confirmation.");
      return;
    }

    // Only send rows that have both a title and a body filled in.
    const validRows = importPreview
      .filter((row) => row.question.trim() && row.answer.trim())
      .map((row) => ({
        question: row.question.trim(),
        answer: row.answer.trim(),
        category: (row.category || "General").trim() || "General",
        tags: Array.isArray(row.tags) ? row.tags : []
      }));

    if (validRows.length === 0) {
      setImportError("Each row needs both a title and a body before it can be imported. Edit or add at least one valid FAQ.");
      return;
    }

    setImportLoading(true);
    setImportError("");
    setImportStatus("");

    try {
      const response = await confirmFaqImport(validRows);
      const importedCount = response?.data?.imported?.length || validRows.length;
      const skipped = importPreview.length - validRows.length;
      let message = `Imported ${importedCount} FAQ(s) successfully.`;
      if (skipped > 0) {
        message += ` Skipped ${skipped} empty/incomplete row${skipped === 1 ? "" : "s"}.`;
      }
      setImportStatus(message);
      setImportPreview([]);
      setImportFileName("");
      setImportFileContent("");
    } catch (err) {
      setImportError(err.message || "Import confirmation failed.");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar openModal={() => setShowModal(true)} />

        <main className="content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <h1 style={{ margin: 0 }}>Admin Console</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "4px 0 0" }}>
                Manage governance, analyze content quality, and monitor search insights.
              </p>
            </div>
            <button
              onClick={loadAdminData}
              style={{ padding: "8px 16px", borderRadius: "6px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Refresh Console
            </button>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444", marginBottom: "20px", fontSize: "14px" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Console Sub-Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
            {["Overview", "Import / Export", "Content Review", "Knowledge Gaps", "Bulk Posting", "Bulk Edit"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "10px 16px",
                  fontSize: "14.5px",
                  fontWeight: 600,
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? "2.5px solid var(--primary-color, #3b82f6)" : "2.5px solid transparent",
                  color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <span className="auth-spinner"></span>
              <p style={{ marginTop: "12px", color: "var(--text-secondary)" }}>Loading admin data...</p>
            </div>
          ) : (
            <>
              {/* Tab 1: Overview */}
              {activeTab === "Overview" && (
                <div>
                  {overview && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
                      <div className="stat-card" style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Registered Users</span>
                        <h2 style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 700 }}>{overview.users}</h2>
                      </div>
                      <div className="stat-card" style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>FAQs Published</span>
                        <h2 style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 700 }}>{overview.faqs}</h2>
                      </div>
                      <div className="stat-card" style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Queries</span>
                        <h2 style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 700 }}>{overview.queries}</h2>
                      </div>
                      <div className="stat-card" style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Answers</span>
                        <h2 style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 700 }}>{overview.answers}</h2>
                      </div>
                    </div>
                  )}

                  <section>
                    <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Pending Queries Review Queue</h2>
                    {pendingQueries.length === 0 ? (
                      <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No pending queries awaiting review.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {pendingQueries.map((query) => (
                          <article key={query._id || query.id} className="question-card" style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                            <h3 style={{ margin: "0 0 8px" }}>{query.question}</h3>
                            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.5" }}>{query.description}</p>
                            <div style={{ marginTop: "12px", display: "flex", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                              <span>Category: <strong>{query.category || "General"}</strong></span>
                              <span>•</span>
                              <span>Author: {query.author || "Community Member"}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* Tab 2: Import / Export */}
              {activeTab === "Import / Export" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
                    <section style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                      <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>Export FAQs</h2>
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", color: "var(--text-secondary)" }}>
                          Format
                          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                            <option value="markdown">Markdown</option>
                            <option value="pdf">PDF</option>
                            <option value="docx">DOCX</option>
                          </select>
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", color: "var(--text-secondary)" }}>
                          Mode
                          <select value={exportMode} onChange={(e) => setExportMode(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <option value="raw">Raw</option>
                            <option value="ai">AI-formatted (PDF/DOCX only)</option>
                          </select>
                        </label>
                        <button onClick={handleExport} style={{ padding: "12px 18px", borderRadius: "8px", backgroundColor: "var(--primary-color, #3b82f6)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                          Download Export
                        </button>
                        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>
                          AI mode is only available for PDF and DOCX exports. JSON, CSV, and Markdown will always download raw exports.
                        </p>
                      </div>
                    </section>

                    <section style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                      <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>Import Document Preview</h2>
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} />
                        <button onClick={handlePreviewImport} style={{ padding: "12px 18px", borderRadius: "8px", backgroundColor: "var(--primary-color, #3b82f6)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                          Preview Document Import
                        </button>
                        {importLoading && <p style={{ margin: 0, color: "var(--text-secondary)" }}>Processing preview…</p>}
                        {importStatus && <p style={{ margin: 0, color: "var(--text-secondary)" }}>{importStatus}</p>}
                        {importError && <p style={{ margin: 0, color: "#ef4444" }}>{importError}</p>}
                      </div>
                    </section>
                  </div>

                  {(importPreview.length > 0 || importStatus.includes("Preview generated")) && (
                    <section style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "18px" }}>Previewed FAQ Candidates</h2>
                          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "13px" }}>
                            Edit the <strong>title</strong> and <strong>body</strong> for each cell. Use <strong>Split</strong> to break a long body into two FAQs, or <strong>Remove</strong> to drop a candidate. Add new rows with the <strong>+</strong> button.
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => addPreviewRow()}
                            title="Add new FAQ row"
                            style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "#3b82f6", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                          >
                            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Add FAQ
                          </button>
                          <button
                            onClick={handleConfirmImport}
                            disabled={!importPreview.length}
                            style={{ padding: "10px 16px", borderRadius: "8px", backgroundColor: importPreview.length ? "#10b981" : "#9ca3af", color: "#fff", border: "none", fontWeight: 700, cursor: importPreview.length ? "pointer" : "not-allowed" }}
                          >
                            Confirm Import ({importPreview.length})
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: "14px" }}>
                        {importPreview.length === 0 && (
                          <div style={{ padding: "24px", textAlign: "center", borderRadius: "10px", border: "1px dashed var(--border)", color: "var(--text-secondary)", fontSize: "13px" }}>
                            No preview rows yet. Click <strong>+ Add FAQ</strong> to insert a new one manually.
                          </div>
                        )}

                        {importPreview.map((item, index) => {
                          const titleMissing = !item.question.trim();
                          const bodyMissing = !item.answer.trim();
                          return (
                            <article
                              key={item.id}
                              style={{
                                padding: "14px 16px",
                                borderRadius: "10px",
                                backgroundColor: "var(--surface-primary, #fff)",
                                border: `1px solid ${titleMissing || bodyMissing ? "#f59e0b" : "var(--border)"}`,
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  FAQ #{index + 1}
                                </span>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    type="button"
                                    onClick={() => splitPreviewRow(item.id)}
                                    title="Split this body into two FAQ rows at the nearest paragraph/sentence break"
                                    style={{ padding: "6px 10px", borderRadius: "6px", backgroundColor: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                                  >
                                    ✂️ Split
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => addPreviewRow({ category: item.category, tags: item.tags })}
                                    title="Add a new empty FAQ row below this one"
                                    style={{ padding: "6px 10px", borderRadius: "6px", backgroundColor: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.3)", color: "#3b82f6", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removePreviewRow(item.id)}
                                    title="Remove this FAQ row"
                                    style={{ padding: "6px 10px", borderRadius: "6px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                                  >
                                    🗑 Remove
                                  </button>
                                </div>
                              </div>

                              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
                                Title (FAQ question)
                                <input
                                  type="text"
                                  value={item.question}
                                  onChange={(e) => updatePreviewRow(item.id, { question: e.target.value })}
                                  placeholder="e.g. How do I reset my password?"
                                  style={{ padding: "10px 12px", borderRadius: "8px", border: `1px solid ${titleMissing ? "#f59e0b" : "var(--border)"}`, backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: "14px", fontWeight: 500 }}
                                />
                                {titleMissing && (
                                  <span style={{ fontSize: "11.5px", color: "#b45309", fontWeight: 500 }}>Title is required before import.</span>
                                )}
                              </label>

                              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
                                Body (FAQ answer)
                                <textarea
                                  value={item.answer}
                                  onChange={(e) => updatePreviewRow(item.id, { answer: e.target.value })}
                                  placeholder="Write or paste the answer body here. Each cell becomes one FAQ."
                                  rows={Math.max(4, Math.min(12, Math.ceil((item.answer || "").length / 80)))}
                                  style={{ padding: "10px 12px", borderRadius: "8px", border: `1px solid ${bodyMissing ? "#f59e0b" : "var(--border)"}`, backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: "14px", lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }}
                                />
                                {bodyMissing && (
                                  <span style={{ fontSize: "11.5px", color: "#b45309", fontWeight: 500 }}>Body is required before import.</span>
                                )}
                              </label>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
                                  Category
                                  <input
                                    type="text"
                                    value={item.category || ""}
                                    onChange={(e) => updatePreviewRow(item.id, { category: e.target.value })}
                                    placeholder="General"
                                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: "13px" }}
                                  />
                                </label>
                                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
                                  Tags (comma separated)
                                  <input
                                    type="text"
                                    value={(item.tags || []).join(", ")}
                                    onChange={(e) => updatePreviewRow(item.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                                    placeholder="e.g. password, account, login"
                                    style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: "13px" }}
                                  />
                                </label>
                              </div>

                              {(item.validationErrors?.length > 0 || item.duplicateScores?.length > 0) && (
                                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                  {item.validationErrors?.length > 0 && (
                                    <div style={{ color: "#b91c1c", marginBottom: "4px" }}>
                                      <strong>Validation:</strong> {item.validationErrors.join("; ")}
                                    </div>
                                  )}
                                  {item.duplicateScores?.length > 0 && (
                                    <div style={{ color: "#6b7280" }}>
                                      <strong>Possible duplicates:</strong>{" "}
                                      {item.duplicateScores.slice(0, 3).map((d) => `${d.question} (${Math.round((d.similarity || 0) * 100)}%)`).join("; ")}
                                    </div>
                                  )}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* Tab 4: Knowledge Gaps */}
              {activeTab === "Knowledge Gaps" && (
                <div>
                  <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Knowledge Gap Analyzer</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 24px" }}>
                    Identify gaps in the content library based on zero-result user searches, unanswered active questions, and outdated stale records.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
                    {/* Failed Searches Column */}
                    <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                      <h3 style={{ margin: "0 0 16px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#ef4444" }}>🔍</span>
                        Failed Search Keywords
                      </h3>
                      {knowledgeGaps.failedSearches.length === 0 ? (
                        <p style={{ color: "var(--text-secondary)", fontSize: "13px", fontStyle: "italic" }}>No zero-result searches logged.</p>
                      ) : (
                        <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                          {knowledgeGaps.failedSearches.map((item, idx) => (
                            <li key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: "6px", backgroundColor: "rgba(0,0,0,0.1)", fontSize: "13.5px" }}>
                              <span style={{ fontWeight: 600 }}>"{item.query}"</span>
                              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Searched {item.count} times</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Unanswered Queries Column */}
                    <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                      <h3 style={{ margin: "0 0 16px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#f59e0b" }}>❓</span>
                        Unanswered Questions
                      </h3>
                      {knowledgeGaps.unansweredQueries.length === 0 ? (
                        <p style={{ color: "var(--text-secondary)", fontSize: "13px", fontStyle: "italic" }}>All pending questions have answers!</p>
                      ) : (
                        <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                          {knowledgeGaps.unansweredQueries.map((item) => (
                            <li key={item._id || item.id} style={{ padding: "8px 10px", borderRadius: "6px", backgroundColor: "rgba(0,0,0,0.1)", fontSize: "13px" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{item.question}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                Asked by {item.author || "User"} • {item.category || "General"}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Stale Content Column */}
                    <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border)" }}>
                      <h3 style={{ margin: "0 0 16px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#3b82f6" }}>⏳</span>
                        Stale FAQs (Needs Update)
                      </h3>
                      {knowledgeGaps.staleFAQs.length === 0 ? (
                        <p style={{ color: "var(--text-secondary)", fontSize: "13px", fontStyle: "italic" }}>No stale FAQ alerts at this time.</p>
                      ) : (
                        <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                          {knowledgeGaps.staleFAQs.map((item) => (
                            <li key={item._id || item.id} style={{ padding: "8px 10px", borderRadius: "6px", backgroundColor: "rgba(0,0,0,0.1)", fontSize: "13px" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{item.question}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                Decay Score: {item.staleScore || item.stale_score || 0} • Category: {item.category || "General"}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Content Review */}
              {activeTab === "Content Review" && (
                <ModerationDashboard />
              )}

              {/* Tab 5: Bulk Posting */}
              {activeTab === "Bulk Posting" && (
                <div>
                  <div style={{ marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "18px", margin: "0 0 4px" }}>Bulk Post FAQs</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
                      Create and publish multiple FAQs at once without uploading a document.
                    </p>
                  </div>
                  <BulkPostingPanel />
                </div>
              )}

              {/* Tab 6: Bulk Edit */}
              {activeTab === "Bulk Edit" && (
                <div>
                  <div style={{ marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "18px", margin: "0 0 4px" }}>Bulk Edit Existing FAQs</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
                      Search, filter, and edit or delete multiple published FAQs at once. Useful for renaming categories in bulk, fixing typos across many entries, or cleaning up outdated content.
                    </p>
                  </div>
                  <BulkEditPanel />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <AskQuestionModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
