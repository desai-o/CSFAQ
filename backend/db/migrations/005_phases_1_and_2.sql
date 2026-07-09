-- SQLite migration: 005_phases_1_and_2.sql
-- Add Answer verification columns
ALTER TABLE answers ADD COLUMN is_verified INTEGER DEFAULT 0;
ALTER TABLE answers ADD COLUMN verified_by TEXT DEFAULT NULL;
ALTER TABLE answers ADD COLUMN verified_at TEXT DEFAULT NULL;
ALTER TABLE answers ADD COLUMN verification_note TEXT DEFAULT NULL;

-- Add FAQ relevance decay / needs-update columns
ALTER TABLE faqs ADD COLUMN stale_score REAL DEFAULT 0;
ALTER TABLE faqs ADD COLUMN last_reviewed_at TEXT DEFAULT NULL;
ALTER TABLE faqs ADD COLUMN needs_update INTEGER DEFAULT 0;
ALTER TABLE faqs ADD COLUMN update_reason TEXT DEFAULT '';

-- Create FAQ revisions table
CREATE TABLE IF NOT EXISTS faq_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faq_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT DEFAULT '',
  user_id TEXT,
  author_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create Query revisions table
CREATE TABLE IF NOT EXISTS query_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_id TEXT NOT NULL,
  question TEXT NOT NULL,
  description TEXT DEFAULT '',
  answer TEXT DEFAULT '',
  category TEXT NOT NULL,
  tags TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  user_id TEXT,
  author_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create Answer revisions table
CREATE TABLE IF NOT EXISTS answer_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  answer_id TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id TEXT,
  author_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
