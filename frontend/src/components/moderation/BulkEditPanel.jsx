import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminAllFaqs,
  bulkEditFaqs,
  bulkDeleteFaqs,
  updateFaq,
  deleteFaq
} from "../../api/faqApi";

/**
 * BulkEditPanel
 * -------------
 * Admin-only FAQ management console. Replaces the old Moderation Queue.
 * Lets an admin:
 *   - search / filter the full FAQ list (including needs_review / rejected)
 *   - multi-select FAQs
 *   - bulk edit a chosen set of fields (question / answer / category / tags / upvotes)
 *     across many FAQs in one round trip
 *   - bulk delete many FAQs in one round trip
 *   - per-row edit / delete for one-off fixes
 *
 * Backend endpoints used (admin-only, see backend/routes/faqRoutes.js):
 *   GET  /faqs/admin/all   — list every FAQ
 *   POST /faqs/bulk-edit   — apply the same {updates} to many {id}s
 *   POST /faqs/bulk-delete — delete many {id}s
 *   PATCH /faqs/:id        — single edit (for per-row edit modal)
 *   DELETE /faqs/:id       — single delete (for per-row delete confirm)
 */
export default function BulkEditPanel() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Filter / search state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");

  // Selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);

  // Modal state
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [singleEditFaq, setSingleEditFaq] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmSingleDelete, setConfirmSingleDelete] = useState(null);

  async function loadFaqs(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      // Request a high limit so every FAQ in the system loads in one
      // round trip. The backend pagination cap is raised to 5000 to
      // match (see backend/utils/pagination.js).
      const response = await fetchAdminAllFaqs(5000, 0);
      setFaqs(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err.message || "Failed to load FAQs.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadFaqs();
  }, []);

  // Stable id accessor (Mongo uses _id, SQLite uses id)
  const idOf = (faq) => String(faq._id ?? faq.id ?? "");

  // Distinct categories for the filter dropdown
  const categories = useMemo(() => {
    const set = new Set();
    faqs.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [faqs]);

  // Apply search + filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((f) => {
      if (categoryFilter !== "__all__" && (f.category || "General") !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "__all__" && (f.moderationStatus || f.moderation_status || "approved") !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        f.question,
        f.answer,
        f.category,
        Array.isArray(f.tags) ? f.tags.join(" ") : (typeof f.tags === "string" ? f.tags : "")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [faqs, search, categoryFilter, statusFilter]);

  // Selection helpers
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((f) => selectedIds.includes(idOf(f)));

  function toggleOne(faq) {
    const id = idOf(faq);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map(idOf));
      setSelectedIds((prev) => prev.filter((x) => !filteredIds.has(x)));
    } else {
      const filteredIds = filtered.map(idOf);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  // Bulk-edit submit
  async function handleBulkEditSubmit(updates) {
    if (selectedIds.length === 0) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const items = selectedIds.map((id) => ({ id, updates }));
      const response = await bulkEditFaqs(items);
      const data = response?.data || {};
      const failedCount = data.failedCount || 0;
      const updatedCount = data.updatedCount || 0;
      if (failedCount > 0) {
        setError(
          `Bulk edit: ${updatedCount} updated, ${failedCount} failed. ${data.failed?.[0]?.message || ""}`
        );
      } else {
        setStatus(`Bulk edit applied to ${updatedCount} FAQ${updatedCount === 1 ? "" : "s"}.`);
      }
      setBulkEditOpen(false);
      await loadFaqs(true);
    } catch (err) {
      setError(err.message || "Bulk edit failed.");
    } finally {
      setBusy(false);
    }
  }

  // Bulk-delete submit
  async function handleBulkDeleteConfirm() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await bulkDeleteFaqs(selectedIds);
      const data = response?.data || {};
      const failedCount = data.failedCount || 0;
      const deletedCount = data.deletedCount || 0;
      if (failedCount > 0) {
        setError(
          `Bulk delete: ${deletedCount} deleted, ${failedCount} failed. ${data.failed?.[0]?.message || ""}`
        );
      } else {
        setStatus(`Deleted ${deletedCount} FAQ${deletedCount === 1 ? "" : "s"}.`);
      }
      setSelectedIds([]);
      setConfirmBulkDelete(false);
      await loadFaqs(true);
    } catch (err) {
      setError(err.message || "Bulk delete failed.");
    } finally {
      setBusy(false);
    }
  }

  // Single-row edit submit
  async function handleSingleEditSubmit(updates) {
    if (!singleEditFaq) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await updateFaq(idOf(singleEditFaq), updates);
      setStatus(`FAQ "${singleEditFaq.question?.slice(0, 40) || "FAQ"}" updated.`);
      setSingleEditFaq(null);
      await loadFaqs(true);
    } catch (err) {
      setError(err.message || "Edit failed.");
    } finally {
      setBusy(false);
    }
  }

  // Single-row delete
  async function handleSingleDeleteConfirm() {
    if (!confirmSingleDelete) return;
    const id = idOf(confirmSingleDelete);
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await deleteFaq(id);
      setStatus(`FAQ deleted.`);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      setConfirmSingleDelete(null);
      await loadFaqs(true);
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mod-bulk-panel">
        <div className="mod-bulk-empty">Loading FAQs…</div>
      </div>
    );
  }

  return (
    <div className="mod-bulk-panel">
      {/* Header */}
      <div className="mod-bulk-header">
        <div>
          <h3 className="mod-bulk-title">Bulk Edit FAQs</h3>
          <p className="mod-bulk-sub">
            Admin-only. Search, filter, and multi-select FAQs to edit fields or delete in bulk. Use the
            checkbox column to select multiple rows, then choose an action from the toolbar.
          </p>
        </div>
        <div className="mod-bulk-actions">
          <button
            type="button"
            onClick={() => loadFaqs()}
            className="mod-btn-clear"
            disabled={busy}
            title="Reload FAQ list"
          >
            ↻ Reload
          </button>
        </div>
      </div>

      {status && <div className="mod-bulk-status">{status}</div>}
      {error && <div className="mod-bulk-error">{error}</div>}

      {/* Filters */}
      <div className="mod-be-filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, body, category, tags…"
          className="mod-be-search"
        />
        <label className="mod-be-filter-field">
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mod-be-select"
          >
            <option value="__all__">All</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>
        <label className="mod-be-filter-field">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mod-be-select"
          >
            <option value="__all__">All</option>
            <option value="approved">Approved</option>
            <option value="needs_review">Needs Review</option>
            <option value="rejected">Rejected</option>
            <option value="auto_clear">Auto-clear</option>
            <option value="escalated">Escalated</option>
          </select>
        </label>
        {(search || categoryFilter !== "__all__" || statusFilter !== "__all__") && (
          <button
            type="button"
            className="mod-btn-clear"
            onClick={() => {
              setSearch("");
              setCategoryFilter("__all__");
              setStatusFilter("__all__");
            }}
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Selection toolbar (visible when something is selected) */}
      <div className="mod-be-toolbar">
        <div className="mod-be-toolbar-left">
          <label className="mod-be-checkall">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
            />
            <span>
              {selectedIds.length} selected
              {filtered.length !== faqs.length ? ` (of ${filtered.length} shown)` : ` (of ${faqs.length})`}
            </span>
          </label>
          {selectedIds.length > 0 && (
            <button type="button" className="mod-btn-clear" onClick={clearSelection}>
              Clear selection
            </button>
          )}
        </div>
        <div className="mod-be-toolbar-right">
          <button
            type="button"
            onClick={() => setBulkEditOpen(true)}
            disabled={selectedIds.length === 0 || busy}
            className={`mod-btn-confirm ${selectedIds.length === 0 || busy ? "is-disabled" : ""}`}
          >
            Bulk Edit ({selectedIds.length})
          </button>
          <button
            type="button"
            onClick={() => setConfirmBulkDelete(true)}
            disabled={selectedIds.length === 0 || busy}
            className={`mod-btn-delete ${selectedIds.length === 0 || busy ? "is-disabled" : ""}`}
          >
            Bulk Delete ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="mod-bulk-empty">
          No FAQs match the current filters.
        </div>
      ) : (
        <div className="mod-be-table-wrap">
          <table className="mod-be-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Question</th>
                <th style={{ width: 130 }}>Category</th>
                <th style={{ width: 200 }}>Tags</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((faq) => {
                const id = idOf(faq);
                const checked = selectedIds.includes(id);
                const tags = Array.isArray(faq.tags)
                  ? faq.tags
                  : typeof faq.tags === "string"
                  ? faq.tags.split(",").map((t) => t.trim()).filter(Boolean)
                  : [];
                const status = faq.moderationStatus || faq.moderation_status || "approved";
                return (
                  <tr key={id} className={checked ? "is-selected" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(faq)}
                        aria-label={`Select FAQ: ${faq.question}`}
                      />
                    </td>
                    <td>
                      <div className="mod-be-q-title">{faq.question || "(untitled)"}</div>
                      <div className="mod-be-q-snippet">
                        {(faq.answer || "").slice(0, 120)}
                        {(faq.answer || "").length > 120 ? "…" : ""}
                      </div>
                    </td>
                    <td>{faq.category || "General"}</td>
                    <td>
                      {tags.length === 0 ? (
                        <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>—</span>
                      ) : (
                        <div className="mod-be-tags">
                          {tags.slice(0, 3).map((t) => (
                            <span key={t} className="mod-be-tag">{t}</span>
                          ))}
                          {tags.length > 3 && (
                            <span className="mod-be-tag is-more">+{tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`mod-be-status mod-be-status-${status}`}>
                        {status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="mod-be-row-actions">
                        <button
                          type="button"
                          className="mod-row-btn"
                          onClick={() => setSingleEditFaq(faq)}
                          disabled={busy}
                        >
                          ✏ Edit
                        </button>
                        <button
                          type="button"
                          className="mod-row-btn mod-row-btn-remove"
                          onClick={() => setConfirmSingleDelete(faq)}
                          disabled={busy}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk-edit modal */}
      {bulkEditOpen && (
        <BulkEditModal
          count={selectedIds.length}
          onCancel={() => setBulkEditOpen(false)}
          onSubmit={handleBulkEditSubmit}
          busy={busy}
        />
      )}

      {/* Single-row edit modal */}
      {singleEditFaq && (
        <BulkEditModal
          count={1}
          singleFaq={singleEditFaq}
          onCancel={() => setSingleEditFaq(null)}
          onSubmit={handleSingleEditSubmit}
          busy={busy}
        />
      )}

      {/* Bulk-delete confirmation */}
      {confirmBulkDelete && (
        <ConfirmModal
          title={`Delete ${selectedIds.length} FAQ${selectedIds.length === 1 ? "" : "s"}?`}
          message={`This will permanently delete ${selectedIds.length} FAQ${selectedIds.length === 1 ? "" : "s"}. This action cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.length}`}
          confirmVariant="danger"
          busy={busy}
          onConfirm={handleBulkDeleteConfirm}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}

      {/* Single-delete confirmation */}
      {confirmSingleDelete && (
        <ConfirmModal
          title="Delete this FAQ?"
          message={`"${confirmSingleDelete.question?.slice(0, 80) || "FAQ"}" will be permanently deleted. This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          busy={busy}
          onConfirm={handleSingleDeleteConfirm}
          onCancel={() => setConfirmSingleDelete(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bulk-edit modal — used for both the multi-select bulk action and   */
/* the single-row edit (when `singleFaq` is provided we prefill).    */
/* ------------------------------------------------------------------ */
function BulkEditModal({ count, singleFaq = null, onCancel, onSubmit, busy }) {
  // When singleFaq is set, every field is "checked" by default.
  const initialChecked = !!singleFaq;
  const initialValues = {
    question: singleFaq?.question || "",
    answer: singleFaq?.answer || "",
    category: singleFaq?.category || "",
    tags: Array.isArray(singleFaq?.tags)
      ? singleFaq.tags.join(", ")
      : typeof singleFaq?.tags === "string"
      ? singleFaq.tags
      : "",
    upvotes:
      singleFaq?.upvotes !== undefined && singleFaq?.upvotes !== null
        ? String(singleFaq.upvotes)
        : ""
  };

  const [checked, setChecked] = useState({
    question: initialChecked,
    answer: initialChecked,
    category: initialChecked,
    tags: initialChecked,
    upvotes: initialChecked
  });
  const [values, setValues] = useState(initialValues);

  const activeCount = Object.values(checked).filter(Boolean).length;

  function handleSubmit() {
    const updates = {};
    if (checked.question && values.question.trim()) updates.question = values.question.trim();
    if (checked.answer && values.answer.trim()) updates.answer = values.answer.trim();
    if (checked.category && values.category.trim()) updates.category = values.category.trim();
    if (checked.tags) {
      const parsed = values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      // Only include tags if user actually entered at least one. If they
      // ticked the box but left the field empty, treat it as "no change"
      // (avoids accidentally wiping tags when the input was forgotten).
      if (parsed.length > 0) updates.tags = parsed;
    }
    if (checked.upvotes && values.upvotes !== "") {
      const n = Number(values.upvotes);
      if (Number.isFinite(n) && n >= 0) updates.upvotes = Math.floor(n);
    }

    if (Object.keys(updates).length === 0) {
      // Nothing to do — keep the modal open via a sentinel: the parent
      // will see no items changed. We surface this with an alert.
      alert("Pick at least one field and enter a new value to apply.");
      return;
    }

    onSubmit(updates);
  }

  return (
    <div className="mod-modal-backdrop" onClick={onCancel}>
      <div className="mod-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mod-modal-head">
          <h3 className="mod-modal-title">
            {singleFaq ? "Edit FAQ" : `Bulk Edit ${count} FAQ${count === 1 ? "" : "s"}`}
          </h3>
          <button type="button" className="mod-modal-close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mod-modal-body">
          {!singleFaq && (
            <p className="mod-modal-help">
              Tick a field to set a new value for every selected FAQ. Untick a field to leave it unchanged.
            </p>
          )}

          <FieldRow
            label="Question"
            checked={checked.question}
            onCheck={(v) => setChecked((p) => ({ ...p, question: v }))}
          >
            <input
              type="text"
              value={values.question}
              onChange={(e) => setValues((p) => ({ ...p, question: e.target.value }))}
              placeholder="New question…"
              className="mod-bulk-input"
              disabled={!checked.question}
            />
          </FieldRow>

          <FieldRow
            label="Answer"
            checked={checked.answer}
            onCheck={(v) => setChecked((p) => ({ ...p, answer: v }))}
          >
            <textarea
              value={values.answer}
              onChange={(e) => setValues((p) => ({ ...p, answer: e.target.value }))}
              placeholder="New answer body…"
              rows={5}
              className="mod-bulk-textarea"
              disabled={!checked.answer}
            />
          </FieldRow>

          <FieldRow
            label="Category"
            checked={checked.category}
            onCheck={(v) => setChecked((p) => ({ ...p, category: v }))}
          >
            <input
              type="text"
              value={values.category}
              onChange={(e) => setValues((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g. General"
              className="mod-bulk-input"
              disabled={!checked.category}
            />
          </FieldRow>

          <FieldRow
            label="Tags"
            checked={checked.tags}
            onCheck={(v) => setChecked((p) => ({ ...p, tags: v }))}
          >
            <input
              type="text"
              value={values.tags}
              onChange={(e) => setValues((p) => ({ ...p, tags: e.target.value }))}
              placeholder="comma, separated, tags"
              className="mod-bulk-input"
              disabled={!checked.tags}
            />
          </FieldRow>

          <FieldRow
            label="Upvotes"
            checked={checked.upvotes}
            onCheck={(v) => setChecked((p) => ({ ...p, upvotes: v }))}
          >
            <input
              type="number"
              min="0"
              value={values.upvotes}
              onChange={(e) => setValues((p) => ({ ...p, upvotes: e.target.value }))}
              placeholder="0"
              className="mod-bulk-input"
              disabled={!checked.upvotes}
            />
          </FieldRow>
        </div>
        <div className="mod-modal-foot">
          <button type="button" className="mod-btn-clear" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || activeCount === 0}
            className={`mod-btn-confirm ${busy || activeCount === 0 ? "is-disabled" : ""}`}
          >
            {busy
              ? "Applying…"
              : singleFaq
              ? "Save Changes"
              : `Apply to ${count} FAQ${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, checked, onCheck, children }) {
  return (
    <label className={`mod-be-field ${checked ? "is-active" : ""}`}>
      <span className="mod-be-field-head">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
        />
        <span className="mod-be-field-label">{label}</span>
      </span>
      <div className="mod-be-field-control">{children}</div>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Generic confirm modal                                               */
/* ------------------------------------------------------------------ */
function ConfirmModal({ title, message, confirmLabel, confirmVariant = "primary", busy, onConfirm, onCancel }) {
  return (
    <div className="mod-modal-backdrop" onClick={onCancel}>
      <div className="mod-modal mod-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="mod-modal-head">
          <h3 className="mod-modal-title">{title}</h3>
          <button type="button" className="mod-modal-close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mod-modal-body">
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
        <div className="mod-modal-foot">
          <button type="button" className="mod-btn-clear" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={confirmVariant === "danger" ? "mod-btn-delete" : "mod-btn-confirm"}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
