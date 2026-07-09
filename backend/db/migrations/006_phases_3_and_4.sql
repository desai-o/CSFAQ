-- SQLite migration: 006_phases_3_and_4.sql

-- Create learning paths table
CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  created_by TEXT DEFAULT 'anonymous',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create learning path items table
CREATE TABLE IF NOT EXISTS learning_path_items (
  learning_path_id TEXT NOT NULL,
  faq_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (learning_path_id, faq_id),
  FOREIGN KEY (learning_path_id) REFERENCES learning_paths(id) ON DELETE CASCADE
);
