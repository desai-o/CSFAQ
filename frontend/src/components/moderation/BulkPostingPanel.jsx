import { useState } from "react";
import { confirmFaqImport } from "../../api/faqApi";

/**
 * BulkPostingPanel
 * ----------------
 * Lets a moderator type one or more FAQs directly (no document upload needed)
 * using the exact same editable-row UI as the Import Preview feature in
 * Admin → Import/Export. The only difference is that the rows are blank
 * from the start (no `previewFaqImport` call). Submission still uses the
 * `confirmFaqImport` API so the payload format is identical to the import
 * path — one row == one FAQ.
 */
export default function BulkPostingPanel() {
  const makeRowId = () => `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // These MUST mirror the rules in backend/services/importService.js
  // (importContent). The service enforces minimum lengths and aborts the
  // whole bulk post if any row fails — so we duplicate the check here to
  // give the moderator immediate visual feedback instead of a 400.
  const MIN_QUESTION_LEN = 10;
  const MIN_ANSWER_LEN = 5;

  const rowIsValid = (row) =>
    row.question.trim().length >= MIN_QUESTION_LEN &&
    row.answer.trim().length >= MIN_ANSWER_LEN;

  // Start with one empty row so the panel is never blank.
  const [rows, setRows] = useState(() => [
    {
      id: makeRowId(),
      question: "",
      answer: "",
      category: "General",
      tags: []
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  // `error` is the summary message; `errorDetails` is the optional list of
  // per-row validation problems returned by the backend. Kept separate so
  // the UI can render them as a proper <ul> rather than a single string
  // (the .mod-bulk-error CSS doesn't preserve \n).
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
  };

  const addRow = (init = {}) => {
    setRows((prev) => [
      ...prev,
      {
        id: makeRowId(),
        question: init.question || "",
        answer: init.answer || "",
        category: init.category || "General",
        tags: Array.isArray(init.tags) ? init.tags : []
      }
    ]);
  };

  // Split a row's body into two at the nearest paragraph/sentence boundary.
  const splitRow = (id) => {
    setRows((prev) => {
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
        id: makeRowId(),
        question: original.question,
        answer: secondHalf,
        category: original.category || "General",
        tags: Array.isArray(original.tags) ? [...original.tags] : []
      };

      const next = [...prev];
      next.splice(idx, 1, updatedOriginal, newRow);
      return next;
    });
  };

  const clearAll = () => {
    setRows([
      {
        id: makeRowId(),
        question: "",
        answer: "",
        category: "General",
        tags: []
      }
    ]);
    setStatus("");
    setError("");
    setErrorDetails([]);
  };

  const handleConfirm = async () => {
    setError("");
    setErrorDetails([]);
    setStatus("");

    // Client-side validation: drop rows that don't meet the backend's
    // minimum-length rules (see MIN_QUESTION_LEN / MIN_ANSWER_LEN above) so
    // we never submit a payload the import service would reject.
    const validRows = rows
      .filter(rowIsValid)
      .map((row) => ({
        question: row.question.trim(),
        answer: row.answer.trim(),
        category: (row.category || "General").trim() || "General",
        tags: Array.isArray(row.tags) ? row.tags : []
      }));

    if (validRows.length === 0) {
      setError(
        `Each row needs a title of at least ${MIN_QUESTION_LEN} characters and a body of at least ${MIN_ANSWER_LEN} characters before it can be posted. Edit or add at least one valid FAQ.`
      );
      return;
    }

    setLoading(true);
    try {
      const response = await confirmFaqImport(validRows);
      const importedCount = response?.data?.imported?.length || validRows.length;
      const skipped = rows.length - validRows.length;
      let message = `Posted ${importedCount} FAQ(s) successfully.`;
      if (skipped > 0) {
        message += ` Skipped ${skipped} empty/incomplete row${skipped === 1 ? "" : "s"}.`;
      }
      setStatus(message);
      // Reset to one fresh empty row
      setRows([
        {
          id: makeRowId(),
          question: "",
          answer: "",
          category: "General",
          tags: []
        }
      ]);
    } catch (err) {
      // The backend (importService.importContent) returns a per-row
      // `details: [{ row, question, errors: [...] }]` array inside the 400
      // response when any row fails validation. Surface that to the
      // moderator instead of dropping it, so they know which rows to fix.
      const perRow = Array.isArray(err?.details) ? err.details : [];
      const summary = err?.message || "Bulk post failed.";
      setError(summary);
      setErrorDetails(perRow);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mod-bulk-panel">
      {/* Header — same shape as Admin Import/Export preview header */}
      <div className="mod-bulk-header">
        <div>
          <h3 className="mod-bulk-title">Bulk Post FAQs</h3>
          <p className="mod-bulk-sub">
            Type one or more FAQs directly. Each cell becomes one published FAQ. Use{" "}
            <strong>Split</strong> to break a long body into two FAQs, or <strong>Remove</strong>{" "}
            to drop a row. Add new rows with the <strong>+</strong> button.
          </p>
        </div>
        <div className="mod-bulk-actions">
          <button
            type="button"
            onClick={() => addRow()}
            title="Add new FAQ row"
            className="mod-btn-add"
          >
            <span className="mod-btn-add-icon">+</span> Add FAQ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!rows.length || loading}
            className={`mod-btn-confirm ${!rows.length || loading ? "is-disabled" : ""}`}
          >
            {loading ? "Posting…" : `Confirm Bulk Post (${rows.length})`}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={loading}
            className="mod-btn-clear"
            title="Clear all rows"
          >
            ✕ Clear All
          </button>
        </div>
      </div>

      {status && <div className="mod-bulk-status">{status}</div>}
      {error && (
        <div className="mod-bulk-error" role="alert">
          <div>{error}</div>
          {errorDetails.length > 0 && (
            <ul className="mod-bulk-error-list">
              {errorDetails.map((d, i) => {
                const q = (d.question || "").trim();
                const snippet = q.length > 60 ? `${q.slice(0, 60)}…` : q;
                const issues = Array.isArray(d.errors)
                  ? d.errors.join("; ")
                  : "validation failed";
                return (
                  <li key={i}>
                    Row {d.row}
                    {q ? `: “${snippet}”` : " (no title)"} — {issues}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Rows — visually identical to Admin Import/Export preview rows */}
      <div className="mod-bulk-rows">
        {rows.length === 0 && (
          <div className="mod-bulk-empty">
            No rows yet. Click <strong>+ Add FAQ</strong> to insert one.
          </div>
        )}

        {rows.map((item, index) => {
          const titleTrimmed = item.question.trim();
          const bodyTrimmed = item.answer.trim();
          const titleMissing = !titleTrimmed;
          const bodyMissing = !bodyTrimmed;
          const titleTooShort = !titleMissing && titleTrimmed.length < MIN_QUESTION_LEN;
          const bodyTooShort = !bodyMissing && bodyTrimmed.length < MIN_ANSWER_LEN;
          const rowInvalid =
            titleMissing || bodyMissing || titleTooShort || bodyTooShort;
          return (
            <article
              key={item.id}
              className={`mod-bulk-row ${rowInvalid ? "is-incomplete" : ""}`}
            >
              <div className="mod-bulk-row-head">
                <span className="mod-bulk-row-index">FAQ #{index + 1}</span>
                <div className="mod-bulk-row-actions">
                  <button
                    type="button"
                    onClick={() => splitRow(item.id)}
                    title="Split this body into two FAQ rows at the nearest paragraph/sentence break"
                    className="mod-row-btn mod-row-btn-split"
                  >
                    ✂️ Split
                  </button>
                  <button
                    type="button"
                    onClick={() => addRow({ category: item.category, tags: item.tags })}
                    title="Add a new empty FAQ row below this one"
                    className="mod-row-btn mod-row-btn-plus"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(item.id)}
                    disabled={rows.length <= 1}
                    title="Remove this FAQ row"
                    className="mod-row-btn mod-row-btn-remove"
                  >
                    🗑 Remove
                  </button>
                </div>
              </div>

              <label className="mod-bulk-field">
                <span className="mod-bulk-field-label">
                  Title (FAQ question) — {titleTrimmed.length}/{MIN_QUESTION_LEN} min
                </span>
                <input
                  type="text"
                  value={item.question}
                  onChange={(e) => updateRow(item.id, { question: e.target.value })}
                  placeholder="e.g. How do I reset my password?"
                  className={`mod-bulk-input ${titleMissing || titleTooShort ? "is-invalid" : ""}`}
                />
                {titleMissing && (
                  <span className="mod-bulk-hint is-warn">Title is required before posting.</span>
                )}
                {!titleMissing && titleTooShort && (
                  <span className="mod-bulk-hint is-warn">
                    Title must be at least {MIN_QUESTION_LEN} characters (currently {titleTrimmed.length}).
                  </span>
                )}
              </label>

              <label className="mod-bulk-field">
                <span className="mod-bulk-field-label">
                  Body (FAQ answer) — {bodyTrimmed.length}/{MIN_ANSWER_LEN} min
                </span>
                <textarea
                  value={item.answer}
                  onChange={(e) => updateRow(item.id, { answer: e.target.value })}
                  placeholder="Type the answer body here. Each cell becomes one FAQ."
                  rows={Math.max(4, Math.min(12, Math.ceil((item.answer || "").length / 80)))}
                  className={`mod-bulk-textarea ${bodyMissing || bodyTooShort ? "is-invalid" : ""}`}
                />
                {bodyMissing && (
                  <span className="mod-bulk-hint is-warn">Body is required before posting.</span>
                )}
                {!bodyMissing && bodyTooShort && (
                  <span className="mod-bulk-hint is-warn">
                    Body must be at least {MIN_ANSWER_LEN} characters (currently {bodyTrimmed.length}).
                  </span>
                )}
              </label>

              <div className="mod-bulk-grid-2">
                <label className="mod-bulk-field">
                  <span className="mod-bulk-field-label">Category</span>
                  <input
                    type="text"
                    value={item.category || ""}
                    onChange={(e) => updateRow(item.id, { category: e.target.value })}
                    placeholder="General"
                    className="mod-bulk-input"
                  />
                </label>
                <label className="mod-bulk-field">
                  <span className="mod-bulk-field-label">Tags (comma separated)</span>
                  <input
                    type="text"
                    value={(item.tags || []).join(", ")}
                    onChange={(e) =>
                      updateRow(item.id, {
                        tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                      })
                    }
                    placeholder="e.g. password, account, login"
                    className="mod-bulk-input"
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
