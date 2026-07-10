const CATEGORY_RULES = [
  {
    category: "NOC",
    keywords: ["noc", "no objection", "hod", "dean", "principal", "signature", "stamp"]
  },
  {
    category: "Selection & Offer",
    keywords: ["selected", "selection", "offer", "offer letter", "acceptance", "withdrawal"]
  },
  {
    category: "Dates & Attendance",
    keywords: ["start date", "end date", "leave", "attendance", "exam", "standup", "zoom"]
  },
  {
    category: "ViBe",
    keywords: ["vibe", "course", "quiz", "video", "proctoring", "camera", "microphone"]
  },
  {
    category: "Rosetta",
    keywords: ["rosetta", "journal", "reflection", "entry"]
  },
  {
    category: "Teams & Projects",
    keywords: ["team", "mentor", "project", "phase 2", "teammate"]
  },
  {
    category: "Certificate",
    keywords: ["certificate", "completion", "grade", "evaluation"]
  },
  {
    category: "Technical Issues",
    keywords: ["login", "dashboard", "bug", "error", "access restricted", "upload"]
  }
];

function inferCategory(text = "") {
  const normalized = text.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }

  return "General";
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((tag) => String(tag).trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
}

module.exports = {
  inferCategory,
  normalizeTags
};
