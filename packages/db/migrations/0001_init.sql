-- Migration 0001 — the mailing list.
-- Both databases replay this file. Each keeps its own d1_migrations ledger.
--
-- consent_at and source are the consent record; neither can be backfilled.
-- exported_at is the hand-off watermark: the exporter selects rows where it is
-- NULL and stamps them, so a second run never resurrects an unsubscribe.

CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name TEXT NOT NULL,
  consent_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  exported_at INTEGER,
  unsubscribed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_waitlist_pending_export ON waitlist (id)
  WHERE exported_at IS NULL AND unsubscribed_at IS NULL;
