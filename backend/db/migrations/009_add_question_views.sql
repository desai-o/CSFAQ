-- Migration 009: add `views` column to questions and queries.
-- This tracks how many times a question / query has been opened
-- in its detail view, so it can be displayed to readers and used
-- for ranking (e.g. trending questions).

ALTER TABLE faqs ADD COLUMN views INTEGER DEFAULT 0;
ALTER TABLE user_queries ADD COLUMN views INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_faqs_views ON faqs(views DESC);
CREATE INDEX IF NOT EXISTS idx_user_queries_views ON user_queries(views DESC);
