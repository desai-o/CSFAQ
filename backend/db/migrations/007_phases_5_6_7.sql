-- SQLite migration: 007_phases_5_6_7.sql

-- Add moderation_status columns
ALTER TABLE faqs ADD COLUMN moderation_status TEXT DEFAULT 'approved';
ALTER TABLE user_queries ADD COLUMN moderation_status TEXT DEFAULT 'approved';
ALTER TABLE answers ADD COLUMN moderation_status TEXT DEFAULT 'approved';

-- Create moderation records table
CREATE TABLE IF NOT EXISTS moderation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mongo_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  flagged INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0.0,
  categories TEXT,
  reason TEXT,
  status TEXT DEFAULT 'needs_review',
  reviewed_by TEXT,
  reviewed_at TEXT,
  audit_trail TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create duplicate links table
CREATE TABLE IF NOT EXISTS duplicate_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mongo_id TEXT,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  similarity REAL DEFAULT 0.0,
  explanation TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  user_id TEXT,
  results_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create chat logs table
CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mongo_id TEXT,
  user_id TEXT,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  retrieved_faqs TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bounties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mongo_id TEXT,
  query_id TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  winner_id TEXT,
  winner_answer_id TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mongo_id TEXT,
  user_id TEXT UNIQUE NOT NULL,
  email_notifications INTEGER DEFAULT 1,
  in_app_notifications INTEGER DEFAULT 1,
  digest_frequency TEXT DEFAULT 'none',
  tag_preferences TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
