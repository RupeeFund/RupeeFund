-- Nullable, not DEFAULT 0: a row nobody asked is not a row that ticked no box.

ALTER TABLE waitlist ADD COLUMN is_foss_user INTEGER;
ALTER TABLE waitlist ADD COLUMN is_foss_contributor INTEGER;
ALTER TABLE waitlist ADD COLUMN is_student INTEGER;
