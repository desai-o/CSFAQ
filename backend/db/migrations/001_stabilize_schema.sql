ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student';
ALTER TABLE users ADD COLUMN badges TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN cohort TEXT DEFAULT '';

ALTER TABLE user_queries ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE user_queries ADD COLUMN category TEXT DEFAULT 'General';
ALTER TABLE user_queries ADD COLUMN tags TEXT DEFAULT '';
ALTER TABLE user_queries ADD COLUMN user_id TEXT DEFAULT 'anonymous';
ALTER TABLE user_queries ADD COLUMN author_name TEXT DEFAULT 'Anonymous';

ALTER TABLE faqs ADD COLUMN category TEXT DEFAULT 'General';
ALTER TABLE faqs ADD COLUMN tags TEXT DEFAULT '';
ALTER TABLE faqs ADD COLUMN search_boost REAL DEFAULT 1;
ALTER TABLE faqs ADD COLUMN user_id TEXT DEFAULT 'anonymous';
ALTER TABLE faqs ADD COLUMN author_name TEXT DEFAULT 'Anonymous';

ALTER TABLE answers ADD COLUMN user_id TEXT DEFAULT 'anonymous';
ALTER TABLE answers ADD COLUMN author_name TEXT DEFAULT 'Community Member';
