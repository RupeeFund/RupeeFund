-- 2026-09-12T03:42:54Z: the push that carried the updates box. 0005 marks older rows NULL.
UPDATE waitlist SET updates_opt_in = 1
  WHERE updates_opt_in IS NULL AND created_at < 1789184574000;

UPDATE waitlist SET
  is_user = coalesce(is_user, 0),
  is_creator = coalesce(is_creator, 0),
  is_professional = coalesce(is_professional, 0),
  is_student = coalesce(is_student, 0),
  backs_nascent = coalesce(backs_nascent, 0),
  backs_growing = coalesce(backs_growing, 0),
  backs_larger = coalesce(backs_larger, 0),
  months = coalesce(months, ''),
  question = coalesce(question, '');
