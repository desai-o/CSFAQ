import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  fetchFaqs,
  submitQuery,
  fetchQueries,
  submitAnswer,
  toggleVote,
  toggleBookmarkApi,
  fetchBookmarks,
  updateAnswer,
  updateFaq,
  updateQuery,
  deleteQuery,
  deleteFaq
} from "../api/faqApi";

const FAQContext = createContext();

const initialQuestions = [
  {
    id: 1,
    title: "Best roadmap for AI/ML in 2026?",
    category: "Artificial Intelligence",
    excerpt: "I'm a sophomore CS student and want to break into AI/ML. What's the best structured roadmap to follow in 2026?",
    description: "I'm a sophomore CS student and want to break into AI/ML. I've taken basic courses in Python and statistics, but I'm unsure about the best path forward. Should I focus on deep learning frameworks first, or build a stronger math foundation? What projects should I work on? What are the must-read papers? I'd appreciate any structured roadmap or advice from people who've made this transition successfully.",
    hashtags: ["AI", "machine-learning", "roadmap", "career"],
    votes: 142,
    voted: false,
    bookmarked: false,
    author: "Alex Chen",
    time: "2 days ago",
    views: 1240,
    answers: [
      {
        id: 1,
        author: "Dr. Sarah Kim",
        avatar: "S",
        content: "Great question! Here's the roadmap I recommend: 1) Start with Andrew Ng's ML course on Coursera. 2) Learn PyTorch — it's the industry standard now. 3) Build 3-4 projects: image classification, NLP sentiment analysis, a recommendation system. 4) Read the 'Attention Is All You Need' paper. 5) Start contributing to open-source ML projects. The key is consistency — spend 2-3 hours daily and you'll see progress within 6 months.",
        votes: 89,
        time: "2 days ago",
        isBest: true,
        voted: false
      },
      {
        id: 2,
        author: "Marcus Wei",
        avatar: "M",
        content: "I'd add that math foundations are crucial. Make sure you're solid on linear algebra, probability, and calculus before diving deep. Fast.ai is also an excellent resource that takes a top-down approach to learning ML.",
        votes: 45,
        time: "1 day ago",
        isBest: false,
        voted: false
      },
      {
        id: 3,
        author: "Priya Sharma",
        avatar: "P",
        content: "Don't forget about Kaggle competitions! They're a great way to build practical experience and your portfolio. Many employers look at Kaggle profiles during hiring.",
        votes: 32,
        time: "1 day ago",
        isBest: false,
        voted: false
      }
    ]
  },
  {
    id: 2,
    title: "How does virtual memory work at the OS level?",
    category: "Programming",
    excerpt: "I understand the concept of virtual memory, but I want to dig deeper into the kernel-level mechanism.",
    description: "I understand the concept of virtual memory abstractly — it gives each process its own address space. But I want to understand the actual kernel-level mechanism. How does page table walking work? What's the TLB? How do page faults trigger disk reads? And how does the OS decide which pages to evict when memory is full?",
    hashtags: ["operating-systems", "memory", "low-level", "kernel"],
    votes: 118,
    voted: false,
    bookmarked: false,
    author: "Jordan Lee",
    time: "4 days ago",
    views: 890,
    answers: [
      {
        id: 1,
        author: "Prof. David Müller",
        avatar: "D",
        content: "Virtual memory works through a combination of hardware (MMU) and software (OS kernel). When a process accesses memory, the CPU's MMU translates virtual addresses to physical addresses using page tables. The TLB (Translation Lookaside Buffer) caches recent translations for speed. On a page fault, the OS handler loads the page from disk, updates the page table, and restarts the instruction. For eviction, Linux uses a modified LRU algorithm called the 'two-list strategy' with active and inactive lists.",
        votes: 67,
        time: "3 days ago",
        isBest: true,
        voted: false
      },
      {
        id: 2,
        author: "Nina Patel",
        avatar: "N",
        content: "I'd recommend reading the xv6 source code — it's a simple teaching OS that implements virtual memory clearly. Chapter 3 of the xv6 book explains page tables beautifully.",
        votes: 28,
        time: "2 days ago",
        isBest: false,
        voted: false
      }
    ]
  },
  {
    id: 3,
    title: "How to prepare for FAANG system design interviews?",
    category: "Career",
    excerpt: "I've been grinding LeetCode but system design still feels overwhelming. What's the best approach?",
    description: "I've been grinding LeetCode for months and feel decent at algorithm problems, but system design interviews are a completely different beast. I don't have experience building large-scale distributed systems. How should I prepare? What resources are best? How much time should I dedicate?",
    hashtags: ["interviews", "system-design", "FAANG", "career"],
    votes: 97,
    voted: false,
    bookmarked: false,
    author: "Taylor Brooks",
    time: "1 day ago",
    views: 2100,
    answers: []
  },
  {
    id: 4,
    title: "Top conferences to publish ML research in 2026?",
    category: "Research",
    excerpt: "I'm working on a paper about transformer architectures. Which conferences should I target?",
    description: "I'm working on a paper about transformer architectures and need to choose target venues. Which are the top-tier conferences (NeurIPS, ICML, ICLR)? Are there any emerging conferences worth considering? What's the typical review timeline?",
    hashtags: ["research", "conferences", "ML", "publishing"],
    votes: 85,
    voted: false,
    bookmarked: false,
    author: "Emma Rodriguez",
    time: "5 days ago",
    views: 650,
    answers: [
      {
        id: 1,
        author: "Dr. Sarah Kim",
        avatar: "S",
        content: "The top three remain NeurIPS, ICML, and ICLR. For more specialized work, consider AAAI, CVPR (for vision), ACL/EMNLP (for NLP). Emerging venues like TMLR (Transactions on ML Research) offer rolling review which can be faster. Typical review cycles are 3-4 months for major conferences.",
        votes: 41,
        time: "4 days ago",
        isBest: true,
        voted: false
      }
    ]
  },
  {
    id: 5,
    title: "Best fully-funded CS PhD programs in Europe?",
    category: "Scholarships",
    excerpt: "Looking for universities with strong AI research groups that offer full funding for international students.",
    description: "Looking for universities with strong AI research groups that offer full funding for international students. I'm particularly interested in natural language processing and reinforcement learning.",
    hashtags: ["scholarships", "PhD", "europe", "funding"],
    votes: 73,
    voted: false,
    bookmarked: false,
    author: "Ryan Park",
    time: "3 days ago",
    views: 1800,
    answers: []
  },
  {
    id: 6,
    title: "Intuition behind eigenvalues in PCA?",
    category: "Mathematics",
    excerpt: "I get the math, but what's the geometric intuition behind why we use eigenvalues in principal component analysis?",
    description: "I get the math behind PCA — compute the covariance matrix, find its eigenvalues and eigenvectors. But what's the geometric intuition? Why do eigenvalues tell us about variance? And why do eigenvectors point in the directions of maximum variance?",
    hashtags: ["linear-algebra", "PCA", "math", "intuition"],
    votes: 64,
    voted: false,
    bookmarked: false,
    author: "Nina Patel",
    time: "6 days ago",
    views: 420,
    answers: [
      {
        id: 1,
        author: "Marcus Wei",
        avatar: "M",
        content: "Think of your data as a cloud of points. The covariance matrix describes the shape of that cloud. Eigenvectors point in the directions where the cloud is stretched the most, and eigenvalues tell you how much stretching there is. PCA finds the axes of the ellipsoid that best fits your data cloud. The largest eigenvalue = the longest axis = the direction of most variance.",
        votes: 38,
        time: "5 days ago",
        isBest: true,
        voted: false
      }
    ]
  },
  {
    id: 7,
    title: "Rust vs Go for backend microservices in 2026?",
    category: "Programming",
    excerpt: "My team is debating between Rust and Go for our new microservices architecture. What are the tradeoffs?",
    description: "My team is debating between Rust and Go for our new microservices architecture. What are the engineering tradeoffs, performance difference, developer velocity, and ecosystem support in 2026?",
    hashtags: ["rust", "golang", "microservices"],
    votes: 56,
    voted: false,
    bookmarked: false,
    author: "Taylor Brooks",
    time: "12 hours ago",
    views: 310,
    answers: []
  },
  {
    id: 8,
    title: "Fine-tuning LLMs with limited compute budget?",
    category: "Artificial Intelligence",
    excerpt: "I only have access to a single A100 GPU. What are practical strategies for fine-tuning large language models?",
    description: "I only have access to a single A100 GPU. What are practical strategies for fine-tuning large language models? Is LoRA, QLoRA, or parameter-efficient fine-tuning standard? What batch sizes and sequence lengths should I use?",
    hashtags: ["LLM", "fine-tuning", "GPU"],
    votes: 45,
    voted: false,
    bookmarked: false,
    author: "Alex Chen",
    time: "1 week ago",
    views: 520,
    answers: []
  }
];

const initialCategories = [
  { name: "Programming", icon: "💻", color: "blue", description: "Languages, frameworks, and software engineering" },
  { name: "Artificial Intelligence", icon: "🤖", color: "orange", description: "ML, deep learning, NLP, and computer vision" },
  { name: "Career", icon: "🎯", color: "green", description: "Job search, interviews, and career growth" },
  { name: "Research", icon: "🔬", color: "yellow", description: "Academic research, papers, and publications" },
  { name: "Scholarships", icon: "🎓", color: "red", description: "Funding, grants, and financial aid" },
  { name: "Mathematics", icon: "📐", color: "purple", description: "Pure and applied mathematics topics" }
];

const initialContributors = [
  { rank: 1, name: "Dr. Sarah Kim", avatar: "S", answers: 342, questions: 28, reputation: 15420, tier: "gold", medal: "🥇" },
  { rank: 2, name: "Marcus Wei", avatar: "M", answers: 289, questions: 45, reputation: 12890, tier: "gold", medal: "🥈" },
  { rank: 3, name: "Priya Sharma", avatar: "P", answers: 256, questions: 32, reputation: 11240, tier: "gold", medal: "🥉" },
  { rank: 4, name: "Alex Chen", avatar: "A", answers: 198, questions: 67, reputation: 8950, tier: "silver", medal: "" },
  { rank: 5, name: "Jordan Lee", avatar: "J", answers: 176, questions: 23, reputation: 7820, tier: "silver", medal: "" },
  { rank: 6, name: "Nina Patel", avatar: "N", answers: 154, questions: 41, reputation: 6540, tier: "silver", medal: "" },
  { rank: 7, name: "Taylor Brooks", avatar: "T", answers: 132, questions: 12, reputation: 5210, tier: "silver", medal: "" },
  { rank: 8, name: "David Müller", avatar: "D", answers: 118, questions: 9, reputation: 4890, tier: "bronze", medal: "" },
  { rank: 9, name: "Emma Rodriguez", avatar: "E", answers: 95, questions: 14, reputation: 3750, tier: "bronze", medal: "" },
  { rank: 10, name: "Ryan Park", avatar: "R", answers: 78, questions: 8, reputation: 2980, tier: "bronze", medal: "" }
];

const QUESTIONS_CACHE_KEY = "crowdfaq_questions_cache";
const UNSYNCED_QUESTIONS_KEY = "crowdfaq_unsynced_questions";
const PENDING_DELETIONS_KEY = "crowdfaq_pending_deletions";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(safeArray(value)));
  } catch (error) {
    console.warn(`Failed to persist ${key}:`, error);
  }
}

// ── Pending deletions ──────────────────────────────────────────────────────
// Persist deletion intent across reloads. When the user clicks Delete with a
// 10-second undo timer and reloads the page during that window, the timer is
// killed and the backend never receives the delete — so the question would
// "reappear" on next load. We record the deletion here so we can retry it on
// app startup. Each entry: { id, sourceType, deletedAt }
function readPendingDeletions() {
  return readJsonArray(PENDING_DELETIONS_KEY);
}

function addPendingDeletion(item) {
  if (!item || item.id == null) return;
  const id = String(item.id);
  const current = readPendingDeletions();
  if (current.some((entry) => String(entry.id) === id)) return;
  const next = [
    ...current,
    {
      id,
      sourceType: item.sourceType || (String(id).startsWith("local-") ? "query" : "query"),
      deletedAt: new Date().toISOString()
    }
  ];
  writeJsonArray(PENDING_DELETIONS_KEY, next);
}

function removePendingDeletion(id) {
  const target = String(id);
  const current = readPendingDeletions();
  const next = current.filter((entry) => String(entry.id) !== target);
  writeJsonArray(PENDING_DELETIONS_KEY, next);
}

function extractEnvelopeArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function normalizeTags(value) {
  let tags = [];
  if (Array.isArray(value)) {
    tags = value.filter(Boolean);
  } else if (typeof value === "string") {
    tags = value
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);
  }

  const uniqueTags = [];
  const seen = new Set();
  for (const tag of tags) {
    const cleanTag = tag.trim();
    const lower = cleanTag.toLowerCase();
    if (cleanTag && !seen.has(lower)) {
      seen.add(lower);
      uniqueTags.push(cleanTag);
    }
  }
  return uniqueTags;
}

function getExcerpt(description) {
  if (!description) return "";
  return description.length > 120
    ? `${description.substring(0, 120)}...`
    : description;
}

// Extract a numeric vote count from any of the fields the backend might
// surface. The backend FAQ/UserQuery models store the cached count under
// `upvotes`, while answers store it under `votes`. We accept either to stay
// robust against schema drift.
function extractVoteCount(source) {
  if (!source || typeof source !== "object") return 0;
  if (typeof source.upvotes === "number") return source.upvotes;
  if (typeof source.votes === "number") return source.votes;
  return 0;
}

function normalizeFaqToQuestion(faq) {
  const id = String(faq.id || faq._id || faq.mongo_id || "");
  const desc = faq.description || faq.answer || "";
  return {
    ...faq,
    id,
    sourceType: "faq",
    title: faq.question || faq.title || "",
    question: faq.question || faq.title || "",
    answer: faq.answer || "",
    description: desc,
    excerpt: faq.excerpt || getExcerpt(desc),
    category: faq.category || "General",
    hashtags: normalizeTags(faq.tags || faq.hashtags || faq.keywords),
    tags: normalizeTags(faq.tags || faq.hashtags || faq.keywords),
    status: faq.status || "resolved",
    // Backend FAQ model exposes the cached count as `upvotes`. We mirror it
    // onto `votes` here so the rest of the UI keeps using a single field.
    upvotes: extractVoteCount(faq),
    votes: extractVoteCount(faq),
    voted: Boolean(faq.voted),
    bookmarked: Boolean(faq.bookmarked),
    author: faq.author || faq.authorName || "Community Member",
    authorId: faq.userId || faq.user_id || faq.authorId,
    isAnonymous: faq.isAnonymous || faq.is_anonymous || false,
    originalAuthorName: faq.originalAuthorName || faq.authorName || faq.author || "Community Member",
    time: faq.createdAt || faq.created_at || faq.time || "Recently",
    views: faq.views || 0,
    answers: faq.answers || [],
    createdAt: faq.createdAt || faq.created_at || new Date().toISOString(),
    updatedAt: faq.updatedAt || faq.updated_at || faq.createdAt || faq.created_at,
    pendingSync: false
  };
}

function normalizeQueryToQuestion(query) {
  const id = String(query.id || query._id || query.mongo_id || "");
  const desc = query.description || query.answer || "";
  return {
    ...query,
    id,
    sourceType: "query",
    title: query.question || query.title || "",
    question: query.question || query.title || "",
    answer: query.answer || "",
    description: desc,
    excerpt: query.excerpt || getExcerpt(desc),
    category: query.category || "General",
    hashtags: normalizeTags(query.tags || query.hashtags),
    tags: normalizeTags(query.tags || query.hashtags),
    status: query.status || "pending",
    // Backend UserQuery model exposes the cached count as `upvotes`.
    upvotes: extractVoteCount(query),
    votes: extractVoteCount(query),
    voted: Boolean(query.voted),
    bookmarked: Boolean(query.bookmarked),
    author: query.author || query.authorName || "Anonymous",
    authorId: query.userId || query.user_id || query.authorId,
    isAnonymous: query.isAnonymous || query.is_anonymous || false,
    originalAuthorName: query.originalAuthorName || query.authorName || query.author || "Anonymous",
    time: query.createdAt || query.created_at || query.time || "Recently",
    views: query.views || 0,
    answers: query.answers || [],
    createdAt: query.createdAt || query.created_at || new Date().toISOString(),
    updatedAt: query.updatedAt || query.updated_at || query.createdAt || query.created_at,
    pendingSync: false
  };
}

function normalizeLocalQuestion(question) {
  const id = String(question.id || `local-${crypto.randomUUID()}`);
  const desc = question.description || question.answer || "";
  return {
    ...question,
    id,
    sourceType: question.sourceType || "query",
    title: question.question || question.title || "",
    question: question.question || question.title || "",
    description: desc,
    excerpt: question.excerpt || getExcerpt(desc),
    category: question.category || "General",
    hashtags: normalizeTags(question.tags || question.hashtags),
    tags: normalizeTags(question.tags || question.hashtags),
    status: question.status || "pending",
    upvotes: extractVoteCount(question),
    votes: extractVoteCount(question),
    voted: Boolean(question.voted),
    bookmarked: Boolean(question.bookmarked),
    author: question.author || question.authorName || "Guest",
    authorId: question.userId || question.user_id || question.authorId,
    isAnonymous: question.isAnonymous || question.is_anonymous || false,
    originalAuthorName: question.originalAuthorName || question.authorName || question.author || "Guest",
    time: question.createdAt || question.created_at || question.time || "Just now",
    views: question.views || 0,
    answers: question.answers || [],
    createdAt: question.createdAt || question.created_at || new Date().toISOString(),
    pendingSync: Boolean(question.pendingSync)
  };
}

function mergeQuestionLists(...lists) {
  const map = new Map();

  lists.flat().filter(Boolean).forEach((item) => {
    const normalized = normalizeLocalQuestion(item);
    const key = normalized.id || `${normalized.sourceType}:${normalized.question}:${normalized.createdAt}`;

    if (!map.has(key)) {
      map.set(key, normalized);
      return;
    }

    const existing = map.get(key);
    map.set(key, {
      ...existing,
      ...normalized,
      pendingSync: existing.pendingSync && !normalized.pendingSync
        ? false
        : normalized.pendingSync || existing.pendingSync
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

export function FAQProvider({ children }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(() => {
    const saved = localStorage.getItem(QUESTIONS_CACHE_KEY) || localStorage.getItem("crowdfaq_questions");
    const parsed = saved ? JSON.parse(saved) : initialQuestions;
    const unsyncedLocal = readJsonArray(UNSYNCED_QUESTIONS_KEY).map(normalizeLocalQuestion);
    const normalizedParsed = parsed.map(item => {
      if (item.sourceType === "faq") return normalizeFaqToQuestion(item);
      return normalizeQueryToQuestion(item);
    });
    return mergeQuestionLists(unsyncedLocal, normalizedParsed);
  });
  const [backendOnline, setBackendOnline] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [pagination, setPagination] = useState({ limit: 20, offset: 0, total: 0 });

  const [contributors, setContributors] = useState(() => {
    const saved = localStorage.getItem("crowdfaq_contributors");
    return saved ? JSON.parse(saved) : initialContributors;
  });

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    writeJsonArray(QUESTIONS_CACHE_KEY, questions);
  }, [questions]);

  useEffect(() => {
    localStorage.setItem("crowdfaq_contributors", JSON.stringify(contributors));
  }, [contributors]);

  async function loadQuestionsFromAllSources(limit = 100, offset = 0) {
    const unsyncedLocal = readJsonArray(UNSYNCED_QUESTIONS_KEY).map(normalizeLocalQuestion);

    try {
      setLoadingQuestions(true);
      const [faqResult, queryResult] = await Promise.allSettled([
        fetchFaqs(limit, offset),
        fetchQueries(limit, offset)
      ]);

      const backendFaqs =
        faqResult.status === "fulfilled"
          ? extractEnvelopeArray(faqResult.value).map(normalizeFaqToQuestion)
          : [];

      const backendQueries =
        queryResult.status === "fulfilled"
          ? extractEnvelopeArray(queryResult.value).map(normalizeQueryToQuestion)
          : [];

      const merged = mergeQuestionLists(unsyncedLocal, backendQueries, backendFaqs);

      setQuestions(merged);
      writeJsonArray(QUESTIONS_CACHE_KEY, merged);
      setBackendOnline(true);

      // After loading questions, merge in bookmark status from backend
      await loadBookmarks();

      const faqTotal = faqResult.status === "fulfilled" && (faqResult.value.meta?.pagination?.total || faqResult.value?.pagination?.total || 0) || 0;
      const queryTotal = queryResult.status === "fulfilled" && (queryResult.value.meta?.pagination?.total || queryResult.value?.pagination?.total || 0) || 0;
      const total = faqTotal + queryTotal;

      setPagination({ limit, offset, total });

      return merged;
    } catch (error) {
      console.warn("Backend question load failed. Using local cache:", error);

      const cached = readJsonArray(QUESTIONS_CACHE_KEY).map(normalizeLocalQuestion);
      const merged = mergeQuestionLists(unsyncedLocal, cached);

      setQuestions(merged);
      setBackendOnline(false);

      return merged;
    } finally {
      setLoadingQuestions(false);
    }
  }

  const loadPage = async (page) => {
    try {
      setLoadingQuestions(true);
      const newOffset = page * pagination.limit;
      await loadQuestionsFromAllSources(pagination.limit, newOffset);
    } catch (err) {
      console.error("Failed to load page", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Load bookmarks from backend and merge into questions state
  const loadBookmarks = async () => {
    if (!user?.id || user.id === "anonymous") return;

    try {
      const response = await fetchBookmarks(user.id);
      const bookmarksData = response?.data || [];

      // Extract question IDs from bookmarks
      const bookmarkedQuestionIds = new Set(
        bookmarksData.map(b => String(b.questionId || b.question_id || b._id))
      );

      // Merge bookmark status into questions
      setQuestions(prev =>
        prev.map(q => ({
          ...q,
          bookmarked: bookmarkedQuestionIds.has(String(q.id))
        }))
      );
    } catch (error) {
      console.warn("Failed to load bookmarks:", error);
    }
  };

  // Process any deletions that were persisted before a reload (i.e., the user
  // clicked Delete with the 10-second undo timer and then reloaded before the
  // backend delete fired). This re-fires the backend delete for each pending
  // entry, so the question is not resurrected on next load.
  const processPendingDeletions = async () => {
    const pending = readPendingDeletions();
    if (!pending || pending.length === 0) return;
    console.log(`[FAQContext] Resuming ${pending.length} pending deletion(s) from previous session.`);

    for (const entry of pending) {
      const id = String(entry.id);
      // Skip local-only ids — they never reached the backend.
      if (id.startsWith("local-")) {
        removePendingDeletion(id);
        continue;
      }
      try {
        if (entry.sourceType === "faq") {
          await deleteFaq(id);
        } else {
          await deleteQuery(id);
        }
        removePendingDeletion(id);
        setQuestions((prev) => prev.filter((q) => String(q.id || q._id) !== id));
      } catch (err) {
        // If the backend says it's already gone (404), treat as success.
        const message = String(err?.message || "");
        if (/404|not found|already|gone/i.test(message)) {
          removePendingDeletion(id);
        } else {
          console.warn(`[FAQContext] Pending deletion failed for ${id}:`, err);
          // Keep it queued so we retry on next mount.
        }
      }
    }
  };

  // Sync with Backend database on mount
  useEffect(() => {
    loadQuestionsFromAllSources();
    // Resume any deletions that were pending before the reload.
    processPendingDeletions();
  }, []);

  // Load bookmarks when user changes
  useEffect(() => {
    if (user?.id && user.id !== "anonymous") {
      loadBookmarks();
    }
  }, [user?.id]);

  function requireLoggedInAction(actionName) {
    if (!user?.id || user.id === "anonymous") {
      throw new Error(`Please log in to ${actionName}.`);
    }
  }

  // ── Anonymous rate-limit ────────────────────────────────────────────────────
  // Stored as a JSON array of timestamps in localStorage.
  // Max 3 anonymous posts per 24h, enforced client-side.
  const ANON_TIMESTAMPS_KEY = "crowdfaq_anon_timestamps";
  const checkAnonymousRateLimit = () => {
    const now = Date.now();
    let timestamps = [];
    try {
      timestamps = JSON.parse(localStorage.getItem(ANON_TIMESTAMPS_KEY) || "[]");
    } catch { timestamps = []; }
    const recent = timestamps.filter(t => now - t < 24 * 60 * 60 * 1000);
    if (recent.length >= 3) {
      throw new Error("Rate limit: You can only make 3 anonymous posts per 24 hours.");
    }
    localStorage.setItem(ANON_TIMESTAMPS_KEY, JSON.stringify([...recent, now]));
  };

  const addQuestion = async (title, category, description, hashtagsString, isAnonymous = false) => {
    requireLoggedInAction("ask a question");
    if (isAnonymous) checkAnonymousRateLimit();

    const authorName = isAnonymous ? "Anonymous User" : (user ? user.name : "Guest");

    const tempQuestion = normalizeLocalQuestion({
      id: `local-${crypto.randomUUID()}`,
      sourceType: "query",
      question: title,
      title,
      description,
      category,
      tags: hashtagsString,
      hashtags: hashtagsString,
      status: "pending",
      pendingSync: true,
      author: authorName,
      authorName: authorName,
      authorId: user?.id || "guest",
      isAnonymous: isAnonymous,
      originalAuthorName: isAnonymous ? (user?.name || "Guest") : authorName,
      createdAt: new Date().toISOString()
    });

    const currentUnsynced = readJsonArray(UNSYNCED_QUESTIONS_KEY).map(normalizeLocalQuestion);
    const nextUnsynced = mergeQuestionLists([tempQuestion], currentUnsynced);

    writeJsonArray(UNSYNCED_QUESTIONS_KEY, nextUnsynced);

    setQuestions((prev) => {
      const merged = mergeQuestionLists([tempQuestion], prev);
      writeJsonArray(QUESTIONS_CACHE_KEY, merged);
      return merged;
    });

    try {
      const response = await submitQuery({
        question: title,
        description,
        category,
        tags: normalizeTags(hashtagsString),
        isAnonymous
      });

      const serverQuestion = normalizeQueryToQuestion(response?.data || response);

      const remainingUnsynced = readJsonArray(UNSYNCED_QUESTIONS_KEY)
        .filter((item) => item.id !== tempQuestion.id);

      writeJsonArray(UNSYNCED_QUESTIONS_KEY, remainingUnsynced);

      setQuestions((prev) => {
        const withoutTemp = prev.filter((item) => item.id !== tempQuestion.id);
        const merged = mergeQuestionLists([serverQuestion], withoutTemp);
        writeJsonArray(QUESTIONS_CACHE_KEY, merged);
        return merged;
      });

      // Update contributor list with this user's question
      setContributors((prev) => {
        const exists = prev.some((c) => c.name === authorName);
        if (exists) {
          return prev.map((c) =>
            c.name === authorName ? { ...c, questions: c.questions + 1 } : c
          );
        }
        return [
          ...prev,
          { rank: 99, name: authorName, avatar: authorName.charAt(0).toUpperCase(), answers: 0, questions: 1, reputation: 5, tier: "bronze" }
        ].sort((a, b) => b.reputation - a.reputation).map((c, i) => ({ ...c, rank: i + 1 }));
      });

      setBackendOnline(true);

      // Important: reload from both /faqs and /queries after server write.
      await loadQuestionsFromAllSources();
      window.dispatchEvent(new CustomEvent("stats:refresh"));

      return serverQuestion;
    } catch (error) {
      console.warn("Question saved locally as unsynced because backend write failed:", error);
      setBackendOnline(false);
      return tempQuestion;
    }
  };
  const editQuestion = (questionId, updatedData) => {
  setQuestions((prev) =>
    prev.map((q) =>
      String(q.id || q._id) === String(questionId)
        ? {
            ...q,
            title: updatedData.title,
            description: updatedData.description,
            category: updatedData.category,
            hashtags: updatedData.hashtags
          }
        : q
    )
  );
  };
  const deleteQuestion = (questionId, sourceType = null) => {
    // Capture the question being removed so we can persist the deletion intent.
    // This way, even if the user reloads before the 10-second timer fires
    // deleteQuery on the backend, we will retry the delete on the next mount.
    const target = questions.find((q) => String(q.id || q._id) === String(questionId));
    if (target) {
      addPendingDeletion({ id: target.id, sourceType: sourceType || target.sourceType || "query" });
    }
    setQuestions((prev) =>
      prev.filter(
        (q) => String(q.id || q._id) !== String(questionId)
      )
    );
  };
  const restoreQuestion = (question) => {
    setQuestions((prev) => [question, ...prev]);
  };
  const removeAnswerLocally = (questionId, answerId) => {
  setQuestions((prev) =>
    prev.map((q) =>
      String(q.id) === String(questionId)
        ? {
            ...q,
            answers: (q.answers || []).filter(
              (a) => String(a.id) !== String(answerId)
            )
          }
        : q
    )
  );
};
const restoreAnswerLocally = (questionId, answer) => {
  setQuestions((prev) =>
    prev.map((q) =>
      String(q.id) === String(questionId)
        ? {
            ...q,
            answers: [answer, ...(q.answers || [])]
          }
        : q
    )
  );
};

  // Helper: pull the latest persisted vote count out of a toggleVote response.
  // Backend returns `meta.voteCount` for both questions and answers; we also
  // fall back to data fields in case the schema varies.
  function readVoteCountFromResponse(response, fallback) {
    if (!response || typeof response !== "object") return fallback;
    const metaCount = response?.meta?.voteCount;
    if (typeof metaCount === "number" && Number.isFinite(metaCount)) return metaCount;
    const dataCount =
      response?.data?.upvotes ??
      response?.data?.votes ??
      response?.upvotes ??
      response?.votes;
    if (typeof dataCount === "number" && Number.isFinite(dataCount)) return dataCount;
    return fallback;
  }

  const upvoteQuestion = async (id) => {
    requireLoggedInAction("upvote");

    const previousQuestions = questions;
    const currentQuestion = questions.find((q) => String(q.id) === String(id));
    if (!currentQuestion) return;
    const isVoted = currentQuestion.voted;
    const delta = isVoted ? -1 : 1;
    const optimisticCount = Math.max(0, (currentQuestion.votes || 0) + delta);

    // The backend no longer guesses which collection a question vote targets
    // (the cross-collection fall-through was removed). We must tell it
    // explicitly: "faq" for canonical FAQs, "query" for community questions.
    // Anything that's not explicitly "faq" is routed through the new
    // dedicated community-questions (UserQuery) helper, mirroring how the
    // FAQ upvotes helper used to own the FAQ collection.
    const rawSourceType = currentQuestion.sourceType;
    const questionType = rawSourceType === "faq" ? "faq" : "query";

    const nextQuestions = questions.map((q) =>
      String(q.id) === String(id)
        ? {
            ...q,
            votes: optimisticCount,
            upvotes: optimisticCount,
            voted: !isVoted
          }
        : q
    );

    try {
      setQuestions(nextQuestions);
      const response = await toggleVote({
        targetType: "question",
        targetId: String(id),
        value: 1,
        questionType
      });

      // Reconcile with the authoritative count from the backend so the UI
      // matches the persisted value (and survives a page reload).
      const authoritativeCount = readVoteCountFromResponse(response, optimisticCount);
      setQuestions((prev) =>
        prev.map((q) =>
          String(q.id) === String(id)
            ? {
                ...q,
                votes: authoritativeCount,
                upvotes: authoritativeCount,
                voted: !isVoted
              }
            : q
        )
      );
    } catch (err) {
      setQuestions(previousQuestions);
      throw err;
    }
  };

  const bookmarkQuestion = async (id) => {
    requireLoggedInAction("bookmark a question");

    const previousQuestions = questions;
    const currentQuestion = questions.find((q) => String(q.id) === String(id));
    if (!currentQuestion) return;
    const isBookmarked = currentQuestion.bookmarked;

    const nextQuestions = questions.map((q) =>
      String(q.id) === String(id)
        ? {
            ...q,
            bookmarked: !isBookmarked
          }
        : q
    );

    try {
      setQuestions(nextQuestions);
      await toggleBookmarkApi({
        questionId: String(id)
      });
    } catch (err) {
      setQuestions(previousQuestions);
      throw err;
    }
  };
  const addAnswer = async (questionId, content, sourceType = "faq", isAnonymous = false) => {
    requireLoggedInAction("submit an answer");
    const cleanContent = content.trim();
    if (!cleanContent) return null;
    if (isAnonymous) checkAnonymousRateLimit();

    const originalAuthorName = user?.name || "Community Member";
    const author = isAnonymous ? "Anonymous User" : originalAuthorName;

    const payload = { content: cleanContent, author, isAnonymous };
    if (sourceType === "query") {
      payload.queryId = questionId;
    } else {
      payload.questionId = questionId;
    }

    try {
      const response = await submitAnswer(payload);

      const savedAnswer = response.data;

      const newAnswer = {
        id: savedAnswer._id || savedAnswer.id,
        userId: savedAnswer.userId || savedAnswer.user_id || user?.id,
        authorId: user?.id,
        originalAuthorName,
        isAnonymous,
        author: isAnonymous ? "Anonymous User" : (savedAnswer.author || originalAuthorName),
        avatar: isAnonymous ? "🕵️" : (savedAnswer.author || originalAuthorName).charAt(0).toUpperCase(),
        content: savedAnswer.content,
        votes: savedAnswer.votes || 0,
        time: "Just now",
        isBest: savedAnswer.isBest || false,
        voted: false
      };

      setQuestions((prev) =>
        prev.map((q) =>
          String(q.id) === String(questionId)
            ? {
                ...q,
                answers: [newAnswer, ...(q.answers || [])]
              }
            : q
        )
      );

      window.dispatchEvent(new CustomEvent("stats:refresh"));

      return newAnswer;
    } catch (err) {
      console.warn("Answer backend write failed. Saving locally:", err.message);

      const fallbackAnswer = {
        id: crypto.randomUUID(),
        authorId: user?.id,
        originalAuthorName,
        isAnonymous,
        author,
        avatar: isAnonymous ? "🕵️" : author.charAt(0).toUpperCase(),
        content: cleanContent,
        votes: 0,
        time: "Just now",
        isBest: false,
        voted: false
      };

      setQuestions((prev) =>
        prev.map((q) =>
          String(q.id) === String(questionId)
            ? {
                ...q,
                answers: [fallbackAnswer, ...(q.answers || [])]
              }
            : q
        )
      );

      return fallbackAnswer;
    }
  };

  const toggleAnonymity = async (itemId, itemType = "question", currentIsAnon = null) => {
    requireLoggedInAction("toggle anonymity");

    // If currentIsAnon not provided, look it up from context
    if (currentIsAnon === null) {
      const currentQ = questions.find((q) =>
        itemType === "question" ? String(q.id) === String(itemId) : true
      );

      if (itemType === "question" && currentQ) {
        currentIsAnon = currentQ.isAnonymous;
      } else if (itemType === "answer") {
        for (const q of questions) {
          const ans = (q.answers || []).find(a => String(a.id) === String(itemId));
          if (ans) {
            currentIsAnon = ans.isAnonymous;
            break;
          }
        }
      }
    }

    // Default to false if still null
    if (currentIsAnon === null) currentIsAnon = false;

    const newIsAnon = !currentIsAnon;
    console.log("toggleAnonymity:", { itemId, itemType, currentIsAnon, newIsAnon });

    // Optimistic update
    setQuestions((prev) => prev.map((q) => {
      if (itemType === "question" && String(q.id) === String(itemId)) {
        return {
          ...q,
          isAnonymous: newIsAnon,
          author: newIsAnon ? "Anonymous User" : (q.originalAuthorName || user?.name || "Community Member")
        };
      }
      if (itemType === "answer") {
        return {
          ...q,
          answers: (q.answers || []).map(ans => {
            if (String(ans.id) === String(itemId)) {
              return {
                ...ans,
                isAnonymous: newIsAnon,
                author: newIsAnon ? "Anonymous User" : (ans.originalAuthorName || user?.name || "Community Member"),
                avatar: newIsAnon ? "🕵️" : (ans.originalAuthorName || user?.name || "C")[0].toUpperCase()
              };
            }
            return ans;
          })
        };
      }
      return q;
    }));

    // Persist to backend
    try {
      if (itemType === "answer") {
        const result = await updateAnswer(itemId, { isAnonymous: newIsAnon });
        console.log("updateAnswer result:", result);
      } else if (itemType === "question") {
        const question = questions.find(q => String(q.id) === String(itemId));
        if (question?.sourceType === "faq") {
          await updateFaq(itemId, { isAnonymous: newIsAnon });
        } else {
          await updateQuery(itemId, { isAnonymous: newIsAnon });
        }
      }
    } catch (err) {
      console.error("Failed to persist anonymity change:", err);
    }
  };

  const upvoteAnswer = async (questionId, answerId) => {
    requireLoggedInAction("upvote");

    const previousQuestions = questions;
    const currentQ = questions.find((q) => String(q.id) === String(questionId));
    if (!currentQ) return;
    const currentAns = (currentQ.answers || []).find((ans) => String(ans.id) === String(answerId));
    if (!currentAns) return;
    const isVoted = currentAns.voted;
    const delta = isVoted ? -1 : 1;
    const optimisticCount = Math.max(0, (currentAns.votes || 0) + delta);

    const nextQuestions = questions.map((q) => {
      if (String(q.id) === String(questionId)) {
        return {
          ...q,
          answers: (q.answers || []).map((ans) =>
            String(ans.id) === String(answerId)
              ? {
                  ...ans,
                  votes: optimisticCount,
                  voted: !isVoted
                }
              : ans
          )
        };
      }
      return q;
    });

    try {
      setQuestions(nextQuestions);
      const response = await toggleVote({
        targetType: "answer",
        targetId: String(answerId),
        value: 1
      });

      // Reconcile with the authoritative count from the backend.
      const authoritativeCount = readVoteCountFromResponse(response, optimisticCount);
      setQuestions((prev) =>
        prev.map((q) => {
          if (String(q.id) !== String(questionId)) return q;
          return {
            ...q,
            answers: (q.answers || []).map((ans) =>
              String(ans.id) === String(answerId)
                ? {
                    ...ans,
                    votes: authoritativeCount,
                    voted: !isVoted
                  }
                : ans
            )
          };
        })
      );
    } catch (err) {
      setQuestions(previousQuestions);
      throw err;
    }
  };

  // Get dynamic categories list with correct question count
  const getDynamicCategories = () => {
    return initialCategories.map((cat) => {
      const count = questions.filter((q) => q.category === cat.name).length;
      // Merge with initial offset counts to make it feel populated
      const offset = cat.name === "Programming" ? 1238
        : cat.name === "Artificial Intelligence" ? 888
        : cat.name === "Career" ? 561
        : cat.name === "Research" ? 339
        : cat.name === "Scholarships" ? 214
        : 177; // Mathematics
      return {
        ...cat,
        questions: count + offset
      };
    });
  };

  return (
    <FAQContext.Provider
      value={{
        questions,
        contributors,
        categories: getDynamicCategories(),
        searchQuery,
        setSearchQuery,
        addQuestion,
        upvoteQuestion,
        bookmarkQuestion,
        editQuestion,
        deleteQuestion,
        restoreQuestion,
        removeAnswerLocally,
        restoreAnswerLocally,
        addAnswer,
        upvoteAnswer,
        toggleAnonymity,
        removePendingDeletion,
        processPendingDeletions,
        backendOnline,
        loadingQuestions,
        pagination,
        loadPage,
        refreshQuestions: () => loadQuestionsFromAllSources(pagination.limit, pagination.offset)
      }}
    >
      {children}
    </FAQContext.Provider>
  );
}

export function useFAQ() {
  return useContext(FAQContext);
}
