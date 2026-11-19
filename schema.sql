CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  country TEXT,
  city TEXT,
  props TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_name ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
