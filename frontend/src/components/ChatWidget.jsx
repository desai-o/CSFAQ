
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendChatMessage, fetchChatStatus } from "../api/faqApi";
import "./ChatWidget.css";

export default function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "model", text: "Hello! I am your CrowdFAQ AI Assistant. How can I help you today?" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOnline, setChatOnline] = useState(null); // null = unknown/loading, true = online, false = offline
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Periodically check whether the Gemini API key is configured and working.
  // The green "online" dot is only shown when the backend reports that the
  // API key is configured AND the probe call succeeds. Otherwise we treat the
  // chatbot as offline and show the gray dot.
  useEffect(() => {
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetchChatStatus();
        const status = res?.data || res || {};
        const online = Boolean(status.configured) && Boolean(status.working) && status.offline === false;
        if (!cancelled) setChatOnline(online);
      } catch (err) {
        if (!cancelled) setChatOnline(false);
      }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 60_000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userText = inputValue.trim();
    setInputValue("");

    const userMessage = { role: "user", text: userText };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        text: m.text
      }));

      const res = await sendChatMessage(userText, chatHistory);

      setMessages((prev) => [
        ...prev,
        { role: "model", text: res.data.response, citations: res.data.citations }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: `Sorry, I encountered an error: ${err.message}. Please try again.` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const parseResponseWithCitations = (text, citations = []) => {
    const regex = /\[FAQ ID:\s*([a-zA-Z0-9_-]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const faqId = match[1];
      parts.push(
        <Link key={matchIndex} to={`/questions/${faqId}`} className="chat-citation-link" onClick={() => setIsOpen(false)}>
          [Source FAQ]
        </Link>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="chat-widget-container">
      {/* Floating Chat Button */}
      <button
        className={`chat-widget-bubble ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Chat with AI Assistant"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg
            width="48"
            height="48"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Gemini"
            className="gemini-icon"
          >
            <defs>
              {/* Icy crystal — lightest facet (top, where light hits) */}
              <linearGradient id="iceTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="55%" stopColor="#DCEEFF" />
                <stop offset="100%" stopColor="#A8D2F2" />
              </linearGradient>
              {/* Icy crystal — left facet */}
              <linearGradient id="iceLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E6F3FF" />
                <stop offset="100%" stopColor="#7FB8E8" />
              </linearGradient>
              {/* Icy crystal — right facet */}
              <linearGradient id="iceRight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C7E5FB" />
                <stop offset="100%" stopColor="#5A9CDB" />
              </linearGradient>
              {/* Icy crystal — deepest facet (bottom) */}
              <linearGradient id="iceBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8FBDE8" />
                <stop offset="100%" stopColor="#2E78C4" />
              </linearGradient>
            </defs>

            {/* Top-Right quadrant — Icy light */}
            <path
              d="M 16 3 C 16 10, 22 16, 29 16 L 16 16 Z"
              fill="url(#iceTop)"
            />
            {/* Bottom-Right quadrant — Icy mid */}
            <path
              d="M 29 16 C 22 16, 16 22, 16 29 L 16 16 Z"
              fill="url(#iceRight)"
            />
            {/* Bottom-Left quadrant — Icy deep */}
            <path
              d="M 16 29 C 16 22, 10 16, 3 16 L 16 16 Z"
              fill="url(#iceBottom)"
            />
            {/* Top-Left quadrant — Icy medium */}
            <path
              d="M 3 16 C 10 16, 16 10, 16 3 L 16 16 Z"
              fill="url(#iceLeft)"
            />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-title">
              <span
                className={`chat-pulse-dot ${
                  chatOnline === false
                    ? "offline"
                    : chatOnline === true
                    ? "online"
                    : "checking"
                }`}
              ></span>
              <h4>AI FAQ Assistant</h4>
            </div>
            <span className="chat-header-subtitle">RAG</span>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-msg-bubble ${msg.role}`}>
                <div className="chat-msg-text">
                  {msg.role === "model" ? parseResponseWithCitations(msg.text, msg.citations) : msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg-bubble model loading">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* User inputs */}
          <div className="chat-footer">
            {!user ? (
              <div className="chat-auth-prompt">
                <span>Please <Link to="/login" onClick={() => setIsOpen(false)}>Sign In</Link> to chat with AI.</span>
              </div>
            ) : (
              <form onSubmit={handleSend} className="chat-input-form">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={loading}
                />
                <button type="submit" disabled={!inputValue.trim() || loading}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
