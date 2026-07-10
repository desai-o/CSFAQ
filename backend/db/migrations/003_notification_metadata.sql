ALTER TABLE notifications ADD COLUMN event_type TEXT DEFAULT '';
ALTER TABLE notifications ADD COLUMN followable_type TEXT DEFAULT '';
ALTER TABLE notifications ADD COLUMN followable_id TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_notifications_followable
ON notifications(followable_type, followable_id);
