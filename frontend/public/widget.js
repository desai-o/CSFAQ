(function() {
  // Prevent duplicate initialization
  if (window.CrowdFAQWidgetInitialized) return;
  window.CrowdFAQWidgetInitialized = true;

  // Configuration
  const API_BASE = 'http://localhost:5000';
  const siteId = document.currentScript ? document.currentScript.getAttribute('data-site-id') : 'default';

  const WIDGET_UNSYNCED_KEY = "crowdfaq_widget_unsynced_questions";

  function widgetReadUnsynced() {
    try {
      return JSON.parse(localStorage.getItem(WIDGET_UNSYNCED_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function widgetWriteUnsynced(items) {
    localStorage.setItem(WIDGET_UNSYNCED_KEY, JSON.stringify(Array.isArray(items) ? items : []));
  }

  function widgetExtractArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    return [];
  }

  function widgetNormalizeFaq(item) {
    return {
      ...item,
      id: String(item.id || item._id || item.mongo_id || ""),
      sourceType: "faq",
      question: item.question || item.title || "",
      answer: item.answer || "",
      status: item.status || "resolved",
      createdAt: item.createdAt || item.created_at || new Date().toISOString()
    };
  }

  function widgetNormalizeQuery(item) {
    return {
      ...item,
      id: String(item.id || item._id || item.mongo_id || ""),
      sourceType: "query",
      question: item.question || item.title || "",
      answer: item.answer || "",
      status: item.status || "pending",
      createdAt: item.createdAt || item.created_at || new Date().toISOString()
    };
  }

  function widgetMergeItems(...lists) {
    const map = new Map();

    lists.flat().filter(Boolean).forEach((item) => {
      const id = String(item.id || item._id || item.mongo_id || item.question);
      if (!map.has(id)) map.set(id, item);
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
  }

  // Inject Google Fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap';
  document.head.appendChild(fontLink);

  // Injected CSS Styles
  const style = document.createElement('style');
  style.textContent = `
    #crowdfaq-widget-root * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    #crowdfaq-widget-root {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
    }

    /* Floating Action Button (FAB) */
    .cf-fab {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border: none;
      outline: none;
    }

    .cf-fab:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 12px 28px rgba(59, 130, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3);
    }

    .cf-fab:active {
      transform: scale(0.95);
    }

    .cf-fab svg {
      width: 26px;
      height: 26px;
      color: #ffffff;
      transition: transform 0.4s ease;
    }

    .cf-fab.active svg {
      transform: rotate(135deg);
    }

    /* Widget Panel Card */
    .cf-panel {
      position: absolute;
      bottom: 76px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 580px;
      max-height: calc(100vh - 120px);
      background: rgba(15, 17, 23, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(24px) scale(0.95);
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .cf-panel.active {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Header */
    .cf-header {
      padding: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.02);
    }

    .cf-logo-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cf-logo-badge {
      background: #ffffff;
      color: #0f1117;
      width: 24px;
      height: 24px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      font-family: 'Outfit', sans-serif;
    }

    .cf-logo-text {
      font-family: 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 700;
      color: #ffffff;
    }

    .cf-close-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      transition: color 0.2s;
    }

    .cf-close-btn:hover {
      color: #ffffff;
    }

    /* Search Bar */
    .cf-search-box {
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .cf-search-input-wrapper {
      position: relative;
      width: 100%;
    }

    .cf-search-input {
      width: 100%;
      padding: 10px 14px 10px 38px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      color: #ffffff;
      font-size: 13.5px;
      outline: none;
      transition: all 0.2s;
    }

    .cf-search-input:focus {
      border-color: #3b82f6;
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.15);
    }

    .cf-search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      width: 16px;
      height: 16px;
      pointer-events: none;
    }

    /* FAQ List Section */
    .cf-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Scrollbar Style */
    .cf-content::-webkit-scrollbar {
      width: 6px;
    }
    .cf-content::-webkit-scrollbar-track {
      background: transparent;
    }
    .cf-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    /* Accordion FAQ Item */
    .cf-faq-item {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .cf-faq-item:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .cf-faq-q {
      padding: 14px;
      font-size: 13.5px;
      font-weight: 600;
      color: #f3f4f6;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      user-select: none;
    }

    .cf-faq-q-text {
      text-align: left;
    }

    .cf-faq-arrow {
      width: 14px;
      height: 14px;
      color: #9ca3af;
      transition: transform 0.3s ease;
      flex-shrink: 0;
    }

    .cf-faq-item.open .cf-faq-arrow {
      transform: rotate(180deg);
      color: #3b82f6;
    }

    .cf-faq-item.open {
      border-color: rgba(59, 130, 246, 0.3);
      background: rgba(59, 130, 246, 0.02);
    }

    .cf-faq-a {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      background: rgba(0, 0, 0, 0.15);
    }

    .cf-faq-a-inner {
      padding: 14px;
      font-size: 12.5px;
      line-height: 1.5;
      color: #9ca3af;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      text-align: left;
    }

    /* No items state */
    .cf-empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
    }

    /* Ask Question Footer Box */
    .cf-footer {
      padding: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);
    }

    .cf-ask-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 8px;
      letter-spacing: 0.05em;
      text-align: left;
      display: block;
    }

    .cf-ask-form {
      display: flex;
      gap: 8px;
    }

    .cf-ask-input {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      color: #ffffff;
      font-size: 13px;
      outline: none;
      transition: all 0.2s;
    }

    .cf-ask-input:focus {
      border-color: #3b82f6;
      background: rgba(255, 255, 255, 0.08);
    }

    .cf-ask-submit {
      background: #3b82f6;
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cf-ask-submit:hover {
      background: #2563eb;
    }

    /* Toast Alert inside Widget */
    .cf-toast {
      position: absolute;
      top: 60px;
      left: 16px;
      right: 16px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 10;
      transform: translateY(-10px);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .cf-toast.success {
      background: #064e3b;
      color: #a7f3d0;
      border: 1px solid #047857;
    }

    .cf-toast.error {
      background: #7f1d1d;
      color: #fca5a5;
      border: 1px solid #b91c1c;
    }

    .cf-toast.show {
      transform: translateY(0);
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // Injected HTML DOM Structure
  const root = document.createElement('div');
  root.id = 'crowdfaq-widget-root';

  root.innerHTML = `
    <!-- Floating Action Button -->
    <button class="cf-fab" id="cf-fab-btn" title="Ask CrowdFAQ">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <!-- Floating Panel -->
    <div class="cf-panel" id="cf-widget-panel">
      <!-- Toast Alert Banner -->
      <div class="cf-toast" id="cf-widget-toast"></div>

      <!-- Header -->
      <div class="cf-header">
        <div class="cf-logo-section">
          <div class="cf-logo-badge">Q</div>
          <span class="cf-logo-text">CrowdFAQ AI Assistant</span>
        </div>
        <button class="cf-close-btn" id="cf-panel-close" title="Close Panel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Search Box -->
      <div class="cf-search-box">
        <div class="cf-search-input-wrapper">
          <svg class="cf-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="cf-search-input" id="cf-widget-search" placeholder="Search community FAQs...">
        </div>
      </div>

      <!-- FAQ Accordion List Scroll Wrapper -->
      <div class="cf-content" id="cf-widget-content">
        <div style="text-align: center; padding: 40px 0; color: #9ca3af; font-size: 13px;">Loading knowledge base...</div>
      </div>

      <!-- Footer Input Section -->
      <div class="cf-footer">
        <span class="cf-ask-label">Ask a new question</span>
        <form class="cf-ask-form" id="cf-widget-ask-form">
          <input type="text" class="cf-ask-input" id="cf-widget-ask-input" placeholder="Type your question here..." required>
          <button type="submit" class="cf-ask-submit">Send</button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Fallback Mock FAQs if Backend is Down
  const fallbackFaqs = [
    {
      id: 'mock-1',
      question: 'What is CrowdFAQ?',
      answer: 'CrowdFAQ is an AI-powered community knowledge platform. It automatically aggregates answers from discussions, summarizes threads using Google Gemini, and enables offline sync capabilities using MongoDB and SQLite.'
    },
    {
      id: 'mock-2',
      question: 'How does the offline-first sync architecture work?',
      answer: 'When connection to the primary database (MongoDB Atlas) drops, CrowdFAQ saves your queries locally into an offline SQLite database. Once the server reconnects, an automated sync pipeline runs in the background to sync SQLite records up to MongoDB.'
    },
    {
      id: 'mock-3',
      question: 'How do I embed the CrowdFAQ widget?',
      answer: 'Simply copy the script tag provided in the Extension section, and paste it into the HTML body of any website. It will automatically load this floating panel!'
    },
    {
      id: 'mock-4',
      question: 'Can I upvote answers or earn contributor badges?',
      answer: 'Yes! High-quality answers receive upvotes. Users earn points which place them in Gold, Silver, or Bronze reputation tiers, displayed on their Contributor Profiles.'
    }
  ];

  let activeFaqs = [];

  // DOM Elements
  const fabBtn = document.getElementById('cf-fab-btn');
  const panel = document.getElementById('cf-widget-panel');
  const closeBtn = document.getElementById('cf-panel-close');
  const searchInput = document.getElementById('cf-widget-search');
  const contentContainer = document.getElementById('cf-widget-content');
  const askForm = document.getElementById('cf-widget-ask-form');
  const askInput = document.getElementById('cf-widget-ask-input');
  const toast = document.getElementById('cf-widget-toast');

  // Toggle Panel Action
  function togglePanel() {
    const isOpen = panel.classList.toggle('active');
    fabBtn.classList.toggle('active', isOpen);
    if (isOpen) {
      searchInput.focus();
    }
  }

  fabBtn.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);

  // Fetch FAQs and Queries from API
  async function fetchFaqsAndQueries() {
    const unsynced = widgetReadUnsynced();

    try {
      const [faqResponse, queryResponse] = await Promise.all([
        fetch(`${API_BASE}/api/faqs`),
        fetch(`${API_BASE}/api/queries`)
      ]);

      const faqPayload = await faqResponse.json();
      const queryPayload = await queryResponse.json();

      const faqs = widgetExtractArray(faqPayload).map(widgetNormalizeFaq);
      const queries = widgetExtractArray(queryPayload).map(widgetNormalizeQuery);

      activeFaqs = widgetMergeItems(unsynced, queries, faqs);

      if (activeFaqs.length === 0) {
        activeFaqs = fallbackFaqs;
      }

      renderFaqs(activeFaqs);
    } catch (error) {
      console.warn("Widget API failed, using unsynced/fallback data:", error);
      activeFaqs = widgetMergeItems(unsynced, fallbackFaqs);
      renderFaqs(activeFaqs);
    }
  }

  // Render FAQ List
  function renderFaqs(items) {
    if (items.length === 0) {
      contentContainer.innerHTML = `
        <div class="cf-empty-state">
          No FAQs match your search query.
        </div>
      `;
      return;
    }

    contentContainer.innerHTML = '';
    items.forEach(item => {
      const faqCard = document.createElement('div');
      faqCard.className = 'cf-faq-item';
      
      faqCard.innerHTML = `
        <div class="cf-faq-q">
          <span class="cf-faq-q-text">${escapeHtml(item.question)}</span>
          <svg class="cf-faq-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="cf-faq-a">
          <div class="cf-faq-a-inner">
            ${escapeHtml(item.answer || 'This question is currently pending community response.')}
          </div>
        </div>
      `;

      // Accordion click listener
      const q = faqCard.querySelector('.cf-faq-q');
      const a = faqCard.querySelector('.cf-faq-a');
      
      q.addEventListener('click', () => {
        const isOpen = faqCard.classList.toggle('open');
        if (isOpen) {
          a.style.maxHeight = a.scrollHeight + 'px';
        } else {
          a.style.maxHeight = '0px';
        }
        
        // Auto-close sibling accordions
        const siblings = contentContainer.querySelectorAll('.cf-faq-item');
        siblings.forEach(sib => {
          if (sib !== faqCard && sib.classList.contains('open')) {
            sib.classList.remove('open');
            sib.querySelector('.cf-faq-a').style.maxHeight = '0px';
          }
        });
      });

      contentContainer.appendChild(faqCard);
    });
  }

  // Filter FAQs on Search
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
      renderFaqs(activeFaqs);
      return;
    }

    const filtered = activeFaqs.filter(faq => 
      faq.question.toLowerCase().includes(term) || 
      (faq.answer && faq.answer.toLowerCase().includes(term))
    );
    renderFaqs(filtered);
  });

  // Submit new Query to Backend
  askForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const questionText = askInput.value.trim();
    if (!questionText) return;

    const tempQuestion = {
      id: `local-${Date.now()}`,
      sourceType: "query",
      question: questionText,
      status: "pending",
      pendingSync: true,
      createdAt: new Date().toISOString()
    };

    const currentUnsynced = widgetReadUnsynced();
    widgetWriteUnsynced(widgetMergeItems([tempQuestion], currentUnsynced));

    try {
      const response = await fetch(`${API_BASE}/api/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionText })
      });

      if (!response.ok) throw new Error('API server rejected request');
      
      const remainingUnsynced = widgetReadUnsynced().filter((item) => item.id !== tempQuestion.id);
      widgetWriteUnsynced(remainingUnsynced);

      showToast('Question submitted successfully!', 'success');
      askInput.value = '';
      await fetchFaqsAndQueries();
    } catch (err) {
      console.error('Failed to submit question to backend:', err);
      showToast('Offline Mode: Question saved locally!', 'success');
      
      activeFaqs = widgetMergeItems([tempQuestion], activeFaqs);
      renderFaqs(activeFaqs);
      askInput.value = '';
    }
  });

  // Show Toast Message inside Widget
  let toastTimeout;
  function showToast(message, type = 'success') {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.className = `cf-toast ${type} show`;
    
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Helper Escape HTML function to prevent XSS
  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // Bootstrap fetching
  fetchFaqsAndQueries();
})();
