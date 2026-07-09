// ─── CrowdFAQ Mock Moderation Data ───────────────────────────────────────────
// This module provides a self-contained mock dataset for the Moderation
// Dashboard. No API calls are made — all state management is client-side.

export const CATEGORIES = [
  "Technology",
  "Health & Wellness",
  "Finance",
  "Education",
  "Legal",
  "Travel",
  "Food & Cooking",
  "Science",
  "Environment",
  "General",
];

export const REPORT_REASONS = [
  "Spam",
  "Duplicate",
  "Inappropriate Language",
  "Incorrect Info",
  "Off-topic",
];

export const CONTENT_TYPES = ["faq", "question", "answer"];

export const STATUSES = ["pending_review", "approved", "rejected", "escalated"];

// ─── Helper to generate realistic moderation history ─────────────────────────
function makeHistory(entries) {
  return entries.map((e) => ({
    action: e.action,
    moderator: e.moderator || "System",
    reason: e.reason || null,
    timestamp: e.timestamp,
  }));
}

// ─── Mock Items ───────────────────────────────────────────────────────────────
export const INITIAL_MOCK_ITEMS = [
  {
    id: "mod-001",
    type: "faq",
    title: "How do I reset my two-factor authentication?",
    body: "I lost my phone and can no longer access my authenticator app. Is there a way to reset 2FA without the backup codes? I tried contacting support but they asked for the backup codes which I also don't have. This is a critical security issue that many users face.",
    author: {
      name: "Priya Sharma",
      initial: "P",
      joinDate: "2024-03-15",
      reputation: 340,
      postCount: 28,
      color: "#8b5cf6",
    },
    createdAt: "2026-06-23T08:30:00Z",
    category: "Technology",
    reportCount: 0,
    status: "pending_review",
    reportReason: "Incorrect Info",
    tags: ["security", "2fa", "authentication"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-23T08:30:00Z",
        reason: "New FAQ submission",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-002",
    type: "answer",
    title: "Re: Best supplements for muscle recovery?",
    body: "BUY NOW!!! BEST SUPPLEMENTS AT AMAZING PRICES!!! Click here → cheapsupps.xyz GET 90% OFF TODAY ONLY!!! LIMITED TIME OFFER!!! This product cured my injuries in 2 days!!! MIRACLE RESULTS!!!",
    author: {
      name: "QuickGainz99",
      initial: "Q",
      joinDate: "2026-06-20",
      reputation: 2,
      postCount: 4,
      color: "#ef4444",
    },
    createdAt: "2026-06-23T09:15:00Z",
    category: "Health & Wellness",
    reportCount: 14,
    status: "pending_review",
    reportReason: "Spam",
    tags: ["spam", "advertising"],
    moderationHistory: makeHistory([
      {
        action: "auto-flagged",
        moderator: "AutoMod",
        timestamp: "2026-06-23T09:16:00Z",
        reason: "High spam score (92%) detected by heuristics",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-003",
    type: "question",
    title: "What is the capital of France?",
    body: "I'm really confused about this. What is the capital city of France? I need to know for a school project due tomorrow. Also can someone tell me where France is located geographically?",
    author: {
      name: "Tommy B.",
      initial: "T",
      joinDate: "2026-05-01",
      reputation: 15,
      postCount: 3,
      color: "#f97316",
    },
    createdAt: "2026-06-22T14:00:00Z",
    category: "Education",
    reportCount: 5,
    status: "pending_review",
    reportReason: "Off-topic",
    tags: ["geography", "basic"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-22T14:00:00Z",
      },
      {
        action: "flagged",
        moderator: "Alice K.",
        timestamp: "2026-06-22T15:30:00Z",
        reason: "Content too basic; does not belong in a specialized FAQ platform",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-004",
    type: "faq",
    title: "Can I invest in stocks without a broker in 2026?",
    body: "With the rise of commission-free apps like Robinhood, Zerodha, and Fidelity, it's now completely possible to invest in stocks without using a traditional broker. You can open a brokerage account directly through these platforms, which act as intermediaries regulated by SEBI or the SEC depending on your country. Always do your due diligence before investing any amount.",
    author: {
      name: "Rohan Mehta",
      initial: "R",
      joinDate: "2023-11-20",
      reputation: 1240,
      postCount: 87,
      color: "#22c55e",
    },
    createdAt: "2026-06-21T11:00:00Z",
    category: "Finance",
    reportCount: 1,
    status: "approved",
    reportReason: "Incorrect Info",
    tags: ["investing", "stocks", "finance"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-21T11:00:00Z",
      },
      {
        action: "approved",
        moderator: "Sarah L.",
        timestamp: "2026-06-21T13:45:00Z",
        reason: "Accurate, well-sourced content.",
      },
    ]),
    notes: "Verified with financial regulations team. Content is accurate as of Q2 2026.",
  },
  {
    id: "mod-005",
    type: "answer",
    title: "Re: How to get a visa for Japan?",
    body: "This is the exact same answer that user @JapanTraveler2024 posted three weeks ago. See thread #3421 for the original. Duplicate content should be removed. The original answer already covers tourist visa, work visa, and student visa requirements comprehensively.",
    author: {
      name: "ContentCop",
      initial: "C",
      joinDate: "2025-01-10",
      reputation: 520,
      postCount: 61,
      color: "#3b82f6",
    },
    createdAt: "2026-06-22T10:00:00Z",
    category: "Travel",
    reportCount: 7,
    status: "rejected",
    reportReason: "Duplicate",
    tags: ["travel", "visa", "japan"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-22T10:00:00Z",
      },
      {
        action: "rejected",
        moderator: "Mark T.",
        timestamp: "2026-06-22T11:30:00Z",
        reason: "Confirmed duplicate of FAQ #3421. Original retained.",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-006",
    type: "question",
    title: "Is it legal to record phone calls without consent in California?",
    body: "I run a small business and need to record calls with clients for quality assurance. California has strict wiretapping laws. Can I record calls without informing the other party? What are the penalties if I accidentally break this law? I've heard different things from different lawyers.",
    author: {
      name: "BizOwner_Ana",
      initial: "B",
      joinDate: "2025-09-05",
      reputation: 185,
      postCount: 19,
      color: "#eab308",
    },
    createdAt: "2026-06-20T16:30:00Z",
    category: "Legal",
    reportCount: 2,
    status: "escalated",
    reportReason: "Incorrect Info",
    tags: ["legal", "california", "privacy"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-20T16:30:00Z",
      },
      {
        action: "escalated",
        moderator: "Dev P.",
        timestamp: "2026-06-20T18:00:00Z",
        reason: "Legal content requires review by a qualified attorney on our advisory board before publishing.",
      },
    ]),
    notes: "Escalated to legal review board. Awaiting response from Atty. Johnson.",
  },
  {
    id: "mod-007",
    type: "faq",
    title: "What are the best practices for password security in 2026?",
    body: "Use a unique, strong password for every account (minimum 16 characters mixing uppercase, lowercase, numbers, and symbols). Enable two-factor authentication (2FA) wherever available. Use a reputable password manager like Bitwarden or 1Password. Avoid using personal information in passwords. Change passwords immediately if you suspect a breach.",
    author: {
      name: "SecureNet_Expert",
      initial: "S",
      joinDate: "2024-02-14",
      reputation: 2890,
      postCount: 156,
      color: "#0ea5e9",
    },
    createdAt: "2026-06-19T09:00:00Z",
    category: "Technology",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["security", "passwords", "best-practices"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-19T09:00:00Z",
      },
      {
        action: "approved",
        moderator: "Alice K.",
        timestamp: "2026-06-19T10:15:00Z",
        reason: "High-quality, comprehensive answer.",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-008",
    type: "answer",
    title: "Re: Why is my sourdough bread too dense?",
    body: "Dense sourdough is usually caused by under-fermentation or a weak starter. Make sure your starter is active and bubbly before use (it should pass the float test). Extend your bulk fermentation time — try 6-8 hours at room temperature. Also, ensure you're building enough gluten through stretch-and-fold techniques during fermentation. Finally, your shaping technique matters — avoid degassing the dough too much.",
    author: {
      name: "Bread_Witch_Maria",
      initial: "B",
      joinDate: "2024-07-22",
      reputation: 670,
      postCount: 43,
      color: "#f59e0b",
    },
    createdAt: "2026-06-18T14:20:00Z",
    category: "Food & Cooking",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["baking", "sourdough", "tips"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-18T14:20:00Z",
      },
      {
        action: "approved",
        moderator: "Mark T.",
        timestamp: "2026-06-18T16:00:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-009",
    type: "question",
    title: "Does climate change affect monsoon patterns in South Asia?",
    body: "Multiple studies have suggested that rising global temperatures are intensifying and altering monsoon patterns across South Asia. The 2025 IPCC report highlighted increased variability, with some regions experiencing more intense rainfall events while others face prolonged dry spells. However, the mechanisms are complex and regional differences are significant. What does the latest research say?",
    author: {
      name: "ClimateWatcher_Aditya",
      initial: "C",
      joinDate: "2024-12-01",
      reputation: 980,
      postCount: 72,
      color: "#10b981",
    },
    createdAt: "2026-06-17T11:45:00Z",
    category: "Environment",
    reportCount: 1,
    status: "pending_review",
    reportReason: "Incorrect Info",
    tags: ["climate", "monsoon", "research"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-17T11:45:00Z",
      },
      {
        action: "flagged",
        moderator: "AutoMod",
        timestamp: "2026-06-17T11:46:00Z",
        reason: "Flagged for expert review due to scientific claims",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-010",
    type: "faq",
    title: "How to apply for a student loan in India?",
    body: "To apply for an education loan in India: 1) Approach your bank with admission letter from institution. 2) Loans up to ₹4 lakhs require no collateral. 3) Loans from ₹4-7.5 lakhs need a third-party guarantor. 4) Loans above ₹7.5 lakhs require tangible collateral. 5) Moratorium period typically covers study period + 6-12 months. 6) Interest subsidy available for economically weaker sections under the Central Sector Interest Subsidy scheme.",
    author: {
      name: "FinGuide_Neha",
      initial: "F",
      joinDate: "2023-08-10",
      reputation: 1560,
      postCount: 104,
      color: "#6366f1",
    },
    createdAt: "2026-06-16T08:00:00Z",
    category: "Finance",
    reportCount: 0,
    status: "pending_review",
    reportReason: null,
    tags: ["education", "loans", "india", "finance"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-16T08:00:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-011",
    type: "answer",
    title: "Re: How to stay motivated while studying?",
    body: "Kill yourself. Nothing matters. Stop studying. Life is meaningless. Why bother with school when the world is burning? Give up now and save yourself the trouble. This advice brought to you by someone who wishes they had quit sooner.",
    author: {
      name: "NihilistUser_X",
      initial: "N",
      joinDate: "2026-06-15",
      reputation: 0,
      postCount: 1,
      color: "#dc2626",
    },
    createdAt: "2026-06-23T22:00:00Z",
    category: "Education",
    reportCount: 23,
    status: "pending_review",
    reportReason: "Inappropriate Language",
    tags: ["harmful", "urgent"],
    moderationHistory: makeHistory([
      {
        action: "auto-flagged",
        moderator: "AutoMod",
        timestamp: "2026-06-23T22:01:00Z",
        reason: "URGENT: Potential self-harm content detected (confidence: 96%). Immediately queued for human review.",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-012",
    type: "question",
    title: "What causes the Northern Lights (Aurora Borealis)?",
    body: "The Aurora Borealis is caused by interactions between the Earth's magnetosphere and charged particles from solar wind. When these particles enter the upper atmosphere, they collide with gas molecules, releasing energy as light. The specific colors depend on the type of gas and altitude — green from oxygen at ~100km, red from oxygen at higher altitudes, blue/purple from nitrogen.",
    author: {
      name: "AstroNerd_Kavya",
      initial: "A",
      joinDate: "2025-03-20",
      reputation: 430,
      postCount: 35,
      color: "#7c3aed",
    },
    createdAt: "2026-06-15T13:30:00Z",
    category: "Science",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["science", "astronomy", "nature"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-15T13:30:00Z",
      },
      {
        action: "approved",
        moderator: "Sarah L.",
        timestamp: "2026-06-15T15:00:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-013",
    type: "faq",
    title: "How do I file a Right to Information (RTI) application in India?",
    body: "To file an RTI application: 1) Identify the Public Information Officer (PIO) of the relevant government department. 2) Write a clear application stating the information needed. 3) Pay the fee of ₹10 (online via RTIonline.gov.in or by postal order/DD). 4) Submit to the PIO. 5) You should receive a response within 30 days (48 hours for life/liberty matters). 6) If denied, file a first appeal within 30 days to the First Appellate Authority.",
    author: {
      name: "CitizenRights_Advocate",
      initial: "C",
      joinDate: "2024-05-12",
      reputation: 875,
      postCount: 58,
      color: "#059669",
    },
    createdAt: "2026-06-14T10:15:00Z",
    category: "Legal",
    reportCount: 1,
    status: "pending_review",
    reportReason: "Incorrect Info",
    tags: ["rti", "legal", "government", "india"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-14T10:15:00Z",
      },
      {
        action: "flagged",
        moderator: "Dev P.",
        timestamp: "2026-06-14T14:00:00Z",
        reason: "One user reported the fee amount may have changed; needs verification.",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-014",
    type: "answer",
    title: "Re: Best budget laptops for college students?",
    body: "The Dell Inspiron 15 (2025) offers excellent value at ₹45,000 with 12th Gen Intel Core i5, 8GB RAM, 512GB SSD. The Acer Aspire 5 is another solid option. For Apple enthusiasts, the M3 MacBook Air with student discount comes to roughly ₹90,000 but offers superior battery life (18h+) and performance for the price. Avoid Celeron/Pentium processors — they'll feel sluggish within a year.",
    author: {
      name: "TechDealsHunter",
      initial: "T",
      joinDate: "2024-09-01",
      reputation: 692,
      postCount: 48,
      color: "#0284c7",
    },
    createdAt: "2026-06-13T16:00:00Z",
    category: "Technology",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["laptops", "students", "budget"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-13T16:00:00Z",
      },
      {
        action: "approved",
        moderator: "Alice K.",
        timestamp: "2026-06-13T17:30:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-015",
    type: "question",
    title: "Is drinking 8 glasses of water per day scientifically proven?",
    body: "The '8 glasses a day' rule is largely a myth without strong scientific backing. Actual hydration needs vary based on body weight, activity level, climate, and diet. The National Academy of Medicine recommends about 3.7L for men and 2.7L for women total daily water intake (including water from food). Listen to your thirst — it's a reliable indicator for most healthy adults.",
    author: {
      name: "HealthDebunker_Siya",
      initial: "H",
      joinDate: "2024-11-30",
      reputation: 1120,
      postCount: 79,
      color: "#16a34a",
    },
    createdAt: "2026-06-12T09:30:00Z",
    category: "Health & Wellness",
    reportCount: 3,
    status: "pending_review",
    reportReason: "Incorrect Info",
    tags: ["health", "hydration", "myths"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-12T09:30:00Z",
      },
      {
        action: "flagged",
        moderator: "AutoMod",
        timestamp: "2026-06-12T09:31:00Z",
        reason: "Health claim flagged for expert verification",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-016",
    type: "faq",
    title: "How to calculate compound interest manually?",
    body: "Compound Interest = P(1 + r/n)^(nt) - P\n\nWhere:\n• P = Principal amount\n• r = Annual interest rate (decimal)\n• n = Number of times interest is compounded per year\n• t = Time in years\n\nExample: ₹1,00,000 at 8% compounded quarterly for 3 years:\nCI = 1,00,000(1 + 0.08/4)^(4×3) - 1,00,000\n   = 1,00,000(1.02)^12 - 1,00,000\n   = 1,26,824 - 1,00,000 = ₹26,824",
    author: {
      name: "MathWiz_Arjun",
      initial: "M",
      joinDate: "2023-06-15",
      reputation: 3100,
      postCount: 210,
      color: "#d946ef",
    },
    createdAt: "2026-06-11T11:00:00Z",
    category: "Finance",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["math", "finance", "interest"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-11T11:00:00Z",
      },
      {
        action: "approved",
        moderator: "Mark T.",
        timestamp: "2026-06-11T12:00:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-017",
    type: "answer",
    title: "Re: Why is the sky blue?",
    body: "The sky appears blue due to Rayleigh scattering. As sunlight passes through the atmosphere, shorter wavelengths of visible light (blue and violet) are scattered more than longer wavelengths (red and orange) by gas molecules. Although violet is scattered even more than blue, our eyes are more sensitive to blue light, and some violet is absorbed in the upper atmosphere — so we perceive the sky as blue.",
    author: {
      name: "PhysicsProf_Rajan",
      initial: "P",
      joinDate: "2023-01-10",
      reputation: 4200,
      postCount: 315,
      color: "#0891b2",
    },
    createdAt: "2026-06-10T14:00:00Z",
    category: "Science",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["physics", "optics", "atmosphere"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-10T14:00:00Z",
      },
      {
        action: "approved",
        moderator: "Sarah L.",
        timestamp: "2026-06-10T14:30:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-018",
    type: "question",
    title: "URGENT: AI is going to replace ALL jobs by 2030 and no one cares!!!",
    body: "Wake up sheeple!!! The globalists are using AI to destroy the working class!!! By 2030, robots will take EVERY job including yours!!! This is a planned demolition of the middle class!!! Share this with everyone before they censor it!!! The government knows but they're suppressing the data!!! Open your eyes!!!",
    author: {
      name: "TruthSeeker_Rex",
      initial: "T",
      joinDate: "2026-06-01",
      reputation: 5,
      postCount: 12,
      color: "#b91c1c",
    },
    createdAt: "2026-06-23T20:00:00Z",
    category: "Technology",
    reportCount: 18,
    status: "pending_review",
    reportReason: "Inappropriate Language",
    tags: ["misinformation", "urgent", "conspiracy"],
    moderationHistory: makeHistory([
      {
        action: "auto-flagged",
        moderator: "AutoMod",
        timestamp: "2026-06-23T20:01:00Z",
        reason: "Conspiracy/misinformation pattern detected. High report velocity.",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-019",
    type: "faq",
    title: "What documents are needed for a passport application in India?",
    body: "For a fresh Indian passport application, you need: 1) Proof of Date of Birth (birth certificate / school leaving certificate / Aadhaar). 2) Proof of Address (Aadhaar / voter ID / utility bill not older than 3 months). 3) Aadhaar Card (mandatory). 4) 2 passport-size photographs (4.5cm × 3.5cm, white background). 5) Completed application form from passportindia.gov.in. Fees vary by type: Normal (₹1,500), Tatkaal (₹3,500).",
    author: {
      name: "GovtHelp_Desk",
      initial: "G",
      joinDate: "2024-04-01",
      reputation: 2200,
      postCount: 145,
      color: "#0f766e",
    },
    createdAt: "2026-06-09T08:00:00Z",
    category: "Legal",
    reportCount: 0,
    status: "pending_review",
    reportReason: null,
    tags: ["passport", "documents", "india", "government"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-09T08:00:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-020",
    type: "answer",
    title: "Re: How to reduce food waste at home?",
    body: "Here are 8 practical tips to reduce food waste: 1) Meal plan before grocery shopping. 2) Store food properly — know which items go in the fridge vs pantry. 3) Use the FIFO method (first in, first out). 4) Learn to use vegetable scraps for stock. 5) Freeze portions you won't use immediately. 6) Understand the difference between 'best before' and 'use by' dates. 7) Compost unavoidable food waste. 8) Use apps like Too Good To Go to buy surplus restaurant food.",
    author: {
      name: "ZeroWaste_Preethi",
      initial: "Z",
      joinDate: "2024-08-18",
      reputation: 788,
      postCount: 54,
      color: "#65a30d",
    },
    createdAt: "2026-06-08T10:30:00Z",
    category: "Environment",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["sustainability", "food", "environment"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-08T10:30:00Z",
      },
      {
        action: "approved",
        moderator: "Alice K.",
        timestamp: "2026-06-08T11:45:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-021",
    type: "question",
    title: "Is it safe to eat raw eggs?",
    body: "Raw eggs carry risk of Salmonella contamination, which can cause food poisoning. However, the actual risk is relatively low — approximately 1 in 20,000 eggs is contaminated. Pasteurized eggs are safer for raw consumption. In Japan, raw egg on rice (tamago gohan) is common due to strict poultry hygiene standards. For high-risk populations (pregnant women, elderly, immunocompromised), raw egg consumption is not recommended.",
    author: {
      name: "FoodSafe_Expert",
      initial: "F",
      joinDate: "2024-06-30",
      reputation: 1340,
      postCount: 91,
      color: "#ca8a04",
    },
    createdAt: "2026-06-07T15:00:00Z",
    category: "Health & Wellness",
    reportCount: 2,
    status: "escalated",
    reportReason: "Incorrect Info",
    tags: ["food-safety", "health", "nutrition"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-07T15:00:00Z",
      },
      {
        action: "flagged",
        moderator: "Mark T.",
        timestamp: "2026-06-07T16:30:00Z",
        reason: "Health/safety claim — needs medical expert review",
      },
      {
        action: "escalated",
        moderator: "Sarah L.",
        timestamp: "2026-06-07T17:00:00Z",
        reason: "Escalated to medical advisory panel for verification before publishing.",
      },
    ]),
    notes: "Sent to Dr. Krishnamurti for review. Expected response: 48h.",
  },
  {
    id: "mod-022",
    type: "faq",
    title: "How does machine learning differ from traditional programming?",
    body: "Traditional programming: Developer writes explicit rules → computer executes them → output.\n\nMachine learning: Developer provides data + desired outputs → algorithm learns the rules automatically → model can predict outputs for new inputs.\n\nKey difference: In ML, the rules are inferred from data rather than manually written. This makes ML powerful for tasks where rules are too complex to articulate explicitly (e.g., image recognition, language translation, fraud detection).",
    author: {
      name: "MLPractitioner_Dev",
      initial: "M",
      joinDate: "2024-01-20",
      reputation: 1890,
      postCount: 123,
      color: "#4f46e5",
    },
    createdAt: "2026-06-06T09:00:00Z",
    category: "Technology",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["ml", "ai", "programming", "technology"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-06T09:00:00Z",
      },
      {
        action: "approved",
        moderator: "Dev P.",
        timestamp: "2026-06-06T10:30:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-023",
    type: "answer",
    title: "Re: Best time to visit Rajasthan?",
    body: "November to February is peak season for Rajasthan — temperatures are pleasant (15-25°C), perfect for sightseeing in Jaipur, Jodhpur, Udaipur, and Jaisalmer. Avoid May-June when temperatures can exceed 45°C. The monsoon (July-September) brings rain but also lush greenery and fewer crowds. Budget travelers might prefer shoulder season (October or March) for lower hotel rates.",
    author: {
      name: "TravelGuru_Meena",
      initial: "T",
      joinDate: "2024-10-15",
      reputation: 560,
      postCount: 38,
      color: "#be185d",
    },
    createdAt: "2026-06-05T13:30:00Z",
    category: "Travel",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["travel", "rajasthan", "india", "tourism"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-05T13:30:00Z",
      },
      {
        action: "approved",
        moderator: "Alice K.",
        timestamp: "2026-06-05T14:45:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-024",
    type: "question",
    title: "Can I use someone else's photo as my profile picture online?",
    body: "Using someone else's photo without permission can violate their right to publicity and may constitute identity misrepresentation. If the photo is protected by copyright, using it without license is copyright infringement. Stock photos require appropriate licensing. If the person is recognizable, it may also violate their right of publicity. Bottom line: get explicit permission from both the photographer (copyright) and the person depicted.",
    author: {
      name: "DigitalLaw_Rahul",
      initial: "D",
      joinDate: "2023-12-05",
      reputation: 2100,
      postCount: 138,
      color: "#0369a1",
    },
    createdAt: "2026-06-04T11:00:00Z",
    category: "Legal",
    reportCount: 1,
    status: "pending_review",
    reportReason: "Incorrect Info",
    tags: ["copyright", "legal", "digital-rights"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-04T11:00:00Z",
      },
    ]),
    notes: "",
  },
  {
    id: "mod-025",
    type: "answer",
    title: "Re: How to improve sleep quality naturally?",
    body: "Evidence-based tips for better sleep: 1) Maintain consistent sleep/wake times (even on weekends). 2) Keep bedroom dark, cool (18-20°C), and quiet. 3) Avoid blue light 1-2 hours before bed (use Night Mode). 4) Cut caffeine after 2pm. 5) Limit alcohol — it disrupts REM sleep. 6) Exercise regularly, but not within 3 hours of bedtime. 7) Try relaxation techniques: box breathing, progressive muscle relaxation, or a brief meditation. 8) If you can't sleep within 20min, get up and do something calm until drowsy.",
    author: {
      name: "SleepDoc_Amara",
      initial: "S",
      joinDate: "2024-04-20",
      reputation: 1780,
      postCount: 112,
      color: "#7c3aed",
    },
    createdAt: "2026-06-03T08:30:00Z",
    category: "Health & Wellness",
    reportCount: 0,
    status: "approved",
    reportReason: null,
    tags: ["sleep", "health", "wellness", "tips"],
    moderationHistory: makeHistory([
      {
        action: "submitted",
        moderator: "System",
        timestamp: "2026-06-03T08:30:00Z",
      },
      {
        action: "approved",
        moderator: "Dev P.",
        timestamp: "2026-06-03T09:00:00Z",
      },
    ]),
    notes: "",
  },
];

// ─── Derived Helpers ──────────────────────────────────────────────────────────

export function computeMetrics(items) {
  return {
    totalPending: items.filter((i) => i.status === "pending_review").length,
    totalFlagged: items.filter((i) => i.reportCount > 0).length,
    totalApproved: items.filter((i) => i.status === "approved").length,
    totalRejected: items.filter((i) => i.status === "rejected").length,
    urgentCount: items.filter(
      (i) => i.status === "pending_review" && i.reportCount >= 10
    ).length,
  };
}

export function applyFilters(items, filters) {
  let result = [...items];

  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        item.author.name.toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }

  if (filters.type !== "all") {
    result = result.filter((item) => item.type === filters.type);
  }

  if (filters.status !== "all") {
    result = result.filter((item) => item.status === filters.status);
  }

  if (filters.category !== "all") {
    result = result.filter((item) => item.category === filters.category);
  }

  switch (filters.sort) {
    case "most_reported":
      result.sort((a, b) => b.reportCount - a.reportCount);
      break;
    case "oldest":
      result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case "most_recent":
    default:
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return result;
}

export function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const STATUS_CONFIG = {
  pending_review: {
    label: "Pending Review",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    icon: "⏳",
  },
  approved: {
    label: "Approved",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    icon: "✅",
  },
  rejected: {
    label: "Rejected",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    icon: "❌",
  },
  escalated: {
    label: "Escalated",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    icon: "🔺",
  },
};

export const TYPE_CONFIG = {
  faq: { label: "FAQ", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  question: {
    label: "Question",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
  },
  answer: { label: "Answer", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};
