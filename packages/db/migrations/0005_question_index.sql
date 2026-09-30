-- The questions list pages by id and reads only rows that carry a question.
-- Without this the predicate walks the primary key and discards most rows, and
-- the read budget is shared with the public signup form.

CREATE INDEX idx_waitlist_question ON waitlist (id)
  WHERE question IS NOT NULL AND question <> '';
