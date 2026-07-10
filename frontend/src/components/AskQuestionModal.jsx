import { useEffect, useState } from "react";
import { useFAQ } from "../context/FAQContext";
import { checkDuplicatesApi } from "../api/faqApi";
import { Link } from "react-router-dom";

function AskQuestionModal({ open, onClose }) {
  const { addQuestion } = useFAQ();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  useEffect(() => {
    if (!title.trim() || title.length < 5) {
      setDuplicates([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        const res = await checkDuplicatesApi(title.trim());
        if (res && res.data) {
          setDuplicates(res.data);
        }
      } catch (err) {
        console.error("Duplicate check error:", err);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [title]);

  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
      setIsAnonymous(false); // Reset on open
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Question title is required.");
      return;
    }

    if (!category) {
      setError("Please select a topic category.");
      return;
    }

    if (!description.trim()) {
      setError("Question details are required.");
      return;
    }

    try {
      await addQuestion(title, category, description, hashtags || "", isAnonymous);
      setTitle("");
      setCategory("");
      setDescription("");
      setHashtags("");
      setError("");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit question.");
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ask a Question</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ color: "var(--accent-red)", marginBottom: "16px", fontWeight: "600", fontSize: "14px" }}>
              ⚠️ {error}
            </div>
          )}

          <label>Title</label>
          <input
            className="modal-input"
            placeholder="What's your question?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {checkingDuplicates && (
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 12px" }}>
              Analyzing for duplicate questions...
            </p>
          )}

          {duplicates.length > 0 && (
            <div style={{
              margin: "8px 0 16px",
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              border: "1px dashed rgba(239, 68, 68, 0.3)"
            }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                Similar Questions Found in Database:
              </span>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {duplicates.map((dup) => (
                  <li key={dup.id} style={{ fontSize: "12.5px", padding: "8px", borderRadius: "6px", backgroundColor: "var(--surface-secondary, rgba(0,0,0,0.02))", borderLeft: dup.similarity > 0.7 ? "3px solid #ef4444" : "3px solid #3b82f6" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <Link to={`/questions/${dup.id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: "600", color: "var(--primary-color, #3b82f6)", textDecoration: "none" }}>
                        {dup.question}
                      </Link>
                      <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", backgroundColor: dup.similarity > 0.7 ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)", color: dup.similarity > 0.7 ? "#ef4444" : "#3b82f6" }}>
                        {Math.round(dup.similarity * 100)}% match
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "11.5px" }}>{dup.explanation}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label>Category</label>
          <select
            className="modal-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select a category</option>
            <option>Programming</option>
            <option>Artificial Intelligence</option>
            <option>Career</option>
            <option>Research</option>
            <option>Scholarships</option>
            <option>Mathematics</option>
          </select>

          <label>Details</label>
          <textarea
            className="modal-input modal-textarea"
            placeholder="Describe your question in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label>Hashtags</label>
          <input
            className="modal-input"
            placeholder="e.g. AI, machine-learning, python (comma-separated)"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
          />

          <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="anonymous-checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label htmlFor="anonymous-checkbox" style={{ fontSize: "14px", cursor: "pointer", color: "var(--text-primary)", userSelect: "none" }}>
              Post anonymously
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-submit" onClick={handleSubmit}>Post Question</button>
        </div>
      </div>
    </div>
  );
}

export default AskQuestionModal;