-- hyunyAI memory database (Cloudflare D1 / SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS devices (
  owner_key TEXT PRIMARY KEY,
  profile_key TEXT NOT NULL DEFAULT 'sihyun',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  session_id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  title TEXT,
  active_mode TEXT DEFAULT 'friend',
  active_world TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_key) REFERENCES devices(owner_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  mode TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES conversations(session_id) ON DELETE CASCADE,
  FOREIGN KEY (owner_key) REFERENCES devices(owner_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'creative',
  subject TEXT,
  content TEXT NOT NULL,
  source_session_id TEXT,
  importance INTEGER NOT NULL DEFAULT 1 CHECK(importance BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_key) REFERENCES devices(owner_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS training_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_key TEXT NOT NULL,
  session_id TEXT,
  mode TEXT,
  user_text TEXT NOT NULL,
  assistant_text TEXT NOT NULL,
  related_worlds TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_key) REFERENCES devices(owner_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_owner_time
  ON messages(owner_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_time
  ON messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_owner_importance
  ON memories(owner_key, importance DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_owner_time
  ON training_examples(owner_key, created_at DESC);
