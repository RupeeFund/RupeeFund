-- Nullable because docs/deploy.md section 4 requires an additive migration:
-- the Worker version running during the deploy predates these columns.

ALTER TABLE waitlist ADD COLUMN amount TEXT;
ALTER TABLE waitlist ADD COLUMN months TEXT;
ALTER TABLE waitlist ADD COLUMN question TEXT;
