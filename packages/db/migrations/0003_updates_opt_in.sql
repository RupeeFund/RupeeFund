-- docs/deploy.md section 4: additive
ALTER TABLE waitlist ADD COLUMN updates_opt_in INTEGER NOT NULL DEFAULT 0;
UPDATE waitlist SET updates_opt_in = 1;
