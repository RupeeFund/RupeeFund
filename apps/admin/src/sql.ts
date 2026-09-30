export const PAGE_SIZE = 50;
export const DAILY_DAYS = 90;

export const MASKED_EMAIL = `CASE
       WHEN instr(email, '@') > 1
         THEN substr(email, 1, 1) || '•••@' || substr(email, instr(email, '@') + 1)
       ELSE '•••'
     END`;

export const TOTALS_SQL = `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN unsubscribed_at IS NULL THEN 1 ELSE 0 END), 0) AS active,
       COALESCE(SUM(CASE WHEN exported_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS exported,
       COALESCE(SUM(updates_opt_in), 0) AS updates_opt_in,
       COALESCE(SUM(is_foss_user), 0) AS foss_users,
       COALESCE(SUM(is_foss_contributor), 0) AS foss_contributors,
       COALESCE(SUM(is_student), 0) AS students,
       COALESCE(SUM(CASE WHEN question IS NOT NULL AND question <> '' THEN 1 ELSE 0 END), 0) AS questions
     FROM waitlist`;

export const SLICES_SQL = `SELECT
       source,
       COALESCE(amount, '') AS amount,
       COALESCE(months, '') AS months,
       COUNT(*) AS n
     FROM waitlist
     GROUP BY source, amount, months`;

export const DAILY_SQL = `SELECT
       date(created_at / 1000, 'unixepoch') AS day,
       COUNT(*) AS n
     FROM waitlist
     GROUP BY day
     ORDER BY day DESC
     LIMIT ?`;

export const PAGE_SQL = `SELECT
       id,
       ${MASKED_EMAIL} AS email_masked,
       name,
       source,
       COALESCE(amount, '') AS amount,
       COALESCE(months, '') AS months,
       updates_opt_in,
       consent_at,
       created_at,
       exported_at,
       unsubscribed_at,
       CASE WHEN question IS NOT NULL AND question <> '' THEN 1 ELSE 0 END AS has_question
     FROM waitlist
     WHERE id < ?
     ORDER BY id DESC
     LIMIT ?`;

export const HAS_QUESTION = `question IS NOT NULL AND question <> ''`;

export const QUESTIONS_SQL = `SELECT
       id,
       ${MASKED_EMAIL} AS email_masked,
       name,
       question,
       created_at,
       unsubscribed_at
     FROM waitlist
     WHERE id < ?
       AND ${HAS_QUESTION}
     ORDER BY id DESC
     LIMIT ?`;

export const REVEAL_SQL = `SELECT email FROM waitlist WHERE id = ?`;
