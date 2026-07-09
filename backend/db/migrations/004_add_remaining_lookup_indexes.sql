CREATE INDEX IF NOT EXISTS idx_answers_query_created
ON answers(query_id, created_at);

CREATE INDEX IF NOT EXISTS idx_votes_target
ON votes(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_question
ON bookmarks(question_id);

CREATE INDEX IF NOT EXISTS idx_follows_followable
ON follows(followable_type, followable_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read_user
ON notifications(user_id, is_read, created_at);
