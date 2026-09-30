import { REASON_FIELDS, ROLE_FIELDS } from "@rupeefund/db/schema";

const BOXES = [...ROLE_FIELDS, ...REASON_FIELDS];

export const PAGE_SIZE = 50;
export const DAILY_DAYS = 90;
export const RATE_DAYS = 30;
export const DAY_MS = 86_400_000;

const DOMAIN = "substr(email, instr(email, '@') + 1)";
const UP_TO_LAST_DOT = `rtrim(${DOMAIN}, replace(${DOMAIN}, '.', ''))`;
const TLD = `substr(${DOMAIN}, length(${UP_TO_LAST_DOT}) + 1)`;
const REST = `substr(${UP_TO_LAST_DOT}, 1, length(${UP_TO_LAST_DOT}) - 1)`;
const SLD = `substr(${REST}, length(rtrim(${REST}, replace(${REST}, '.', ''))) + 1)`;
const SECOND_LEVEL = "('ac','co','com','edu','gen','gov','ind','mil','net','nic','org','res')";
const GENERIC = "('app','biz','com','dev','edu','gov','info','int','mil','net','org')";

const MASKED_EMAIL = `CASE
       WHEN instr(email, '@') = 0 OR instr(${DOMAIN}, '.') = 0 THEN '••••@•••••'
       WHEN NOT (${TLD} GLOB '[a-z][a-z]' OR ${TLD} IN ${GENERIC}) THEN '••••@•••••'
       WHEN instr(${REST}, '.') > 0 AND ${SLD} IN ${SECOND_LEVEL}
         THEN '••••@•••••.' || ${SLD} || '.' || ${TLD}
       ELSE '••••@•••••.' || ${TLD}
     END`;

const ACTIVE = "unsubscribed_at IS NULL";
const HAS_QUESTION = "question IS NOT NULL AND question <> ''";

function activeSum(value: string, alias: string): string {
  return `COALESCE(SUM(CASE WHEN ${ACTIVE} THEN ${value} END), 0) AS ${alias}`;
}

function answered(fields: readonly string[], alias: string): string {
  return `COUNT(CASE WHEN ${ACTIVE} THEN COALESCE(${fields.join(", ")}) END) AS ${alias}`;
}

export const TOTALS_SQL = `SELECT
       COUNT(*) AS total,
       ${activeSum("1", "active")},
       ${activeSum("exported_at IS NULL", "pending")},
       ${activeSum("created_at >= ?1", "recent_joined")},
       COALESCE(SUM(CASE WHEN created_at < ?1 AND unsubscribed_at >= ?1 THEN 1 ELSE 0 END), 0)
         AS recent_left,
       ${activeSum("updates_opt_in", "updates_opt_in")},
       COUNT(CASE WHEN ${ACTIVE} THEN updates_opt_in END) AS updates_asked,
       ${answered(ROLE_FIELDS, "roles_answered")},
       ${answered(REASON_FIELDS, "reasons_answered")},
       ${BOXES.map((field) => `${activeSum(field, field)},`).join("\n       ")}
       COALESCE(SUM(CASE WHEN ${HAS_QUESTION} THEN 1 ELSE 0 END), 0) AS questions
     FROM waitlist`;

export const AMOUNTS_SQL = `SELECT
       amount,
       COUNT(*) AS n
     FROM waitlist
     WHERE ${ACTIVE} AND amount IS NOT NULL
     GROUP BY amount
     ORDER BY amount`;

export const DAILY_SQL = `SELECT
       date(created_at / 1000, 'unixepoch') AS day,
       COUNT(*) AS n
     FROM waitlist
     WHERE ${ACTIVE}
     GROUP BY day
     ORDER BY day DESC
     LIMIT ?`;

export const PAGE_SQL = `SELECT
       id,
       ${MASKED_EMAIL} AS email_masked,
       name,
       source,
       amount,
       months,
       updates_opt_in,
       ${BOXES.join(",\n       ")},
       consent_at,
       created_at,
       updated_at,
       exported_at,
       unsubscribed_at,
       CASE WHEN ${HAS_QUESTION} THEN 1 ELSE 0 END AS has_question
     FROM waitlist
     WHERE id < ?
     ORDER BY id DESC
     LIMIT ?`;

export const QUESTIONS_SQL = `SELECT
       id,
       ${MASKED_EMAIL} AS email_masked,
       name,
       question,
       created_at,
       exported_at,
       unsubscribed_at
     FROM waitlist
     WHERE id < ?
       AND ${HAS_QUESTION}
     ORDER BY id DESC
     LIMIT ?`;

export const REVEAL_SQL = `SELECT email FROM waitlist WHERE id = ?`;
