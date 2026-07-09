CREATE INDEX IF NOT EXISTS idx_user_queries_synced ON user_queries(synced_to_mongo);
CREATE INDEX IF NOT EXISTS idx_faqs_synced ON faqs(synced_to_mongo);
CREATE INDEX IF NOT EXISTS idx_answers_synced ON answers(synced_to_mongo);
CREATE INDEX IF NOT EXISTS idx_votes_synced ON votes(synced_to_mongo);
CREATE INDEX IF NOT EXISTS idx_bookmarks_synced ON bookmarks(synced_to_mongo);
CREATE INDEX IF NOT EXISTS idx_events_synced ON events(synced_to_mongo);

CREATE INDEX IF NOT EXISTS idx_user_queries_user_created ON user_queries(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_faqs_user_created ON faqs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_answers_question_created ON answers(question_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);
