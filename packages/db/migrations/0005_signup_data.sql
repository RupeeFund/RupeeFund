-- A rebuild, not additive: the one exception to docs/DEPLOY.md section 4.
-- The Worker live during the promote writes the old role columns, so a signup
-- fails until the new Worker is live. The operator accepted that on 2026-09-30.

CREATE TABLE waitlist_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name TEXT NOT NULL,
  consent_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  exported_at INTEGER,
  unsubscribed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  amount INTEGER CHECK (amount IS NULL OR (typeof(amount) = 'integer' AND amount >= 1)),
  months TEXT,
  question TEXT,
  updates_opt_in INTEGER CHECK (updates_opt_in IN (0, 1)),
  is_user INTEGER CHECK (is_user IN (0, 1)),
  is_creator INTEGER CHECK (is_creator IN (0, 1)),
  is_professional INTEGER CHECK (is_professional IN (0, 1)),
  is_student INTEGER CHECK (is_student IN (0, 1)),
  backs_nascent INTEGER CHECK (backs_nascent IN (0, 1)),
  backs_growing INTEGER CHECK (backs_growing IN (0, 1)),
  backs_larger INTEGER CHECK (backs_larger IN (0, 1))
);

WITH cleaned AS (
  SELECT *,
    replace(replace(replace(replace(replace(replace(replace(
      lower(trim(amount)), '₹', ''), 'rs.', ''), 'rs', ''), 'inr', ''), '/-', ''),
      ',', ''), ' ', '') AS amount_digits
  FROM waitlist
)
INSERT INTO waitlist_next
  (id, email, name, consent_at, source, exported_at, unsubscribed_at, created_at, updated_at,
   amount, months, question, updates_opt_in, is_user, is_creator, is_student)
SELECT
  id, email, name, consent_at, source, exported_at, unsubscribed_at, created_at, updated_at,
  CASE
    WHEN amount_digits <> '' AND amount_digits NOT GLOB '*[^0-9]*' AND length(amount_digits) <= 15
      AND CAST(amount_digits AS INTEGER) >= 1
    THEN CAST(amount_digits AS INTEGER)
  END,
  months,
  question,
  -- 2026-09-12T03:42:54Z: the push to live that carried dde9d70 (0003 and the updates box).
  CASE WHEN created_at < 1789184574000 THEN NULL ELSE updates_opt_in END,
  is_foss_user,
  is_foss_contributor,
  is_student
FROM cleaned;

UPDATE sqlite_sequence
  SET seq = (SELECT seq FROM sqlite_sequence WHERE name = 'waitlist')
  WHERE name = 'waitlist_next'
    AND seq < (SELECT seq FROM sqlite_sequence WHERE name = 'waitlist');

INSERT INTO sqlite_sequence (name, seq)
  SELECT 'waitlist_next', seq FROM sqlite_sequence
  WHERE name = 'waitlist'
    AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'waitlist_next');

DROP TABLE waitlist;

ALTER TABLE waitlist_next RENAME TO waitlist;

CREATE INDEX idx_waitlist_pending_export ON waitlist (id)
  WHERE exported_at IS NULL AND unsubscribed_at IS NULL;

CREATE INDEX idx_waitlist_question ON waitlist (id)
  WHERE question IS NOT NULL AND question <> '';
