const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const WAITLIST_SOURCES = ["subscribe", "landing", "footer"] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];
const DEFAULT_WAITLIST_SOURCE: WaitlistSource = "subscribe";

export const AMOUNT_OPTIONS = ["15", "128", "512"] as const;
export const AMOUNT_OTHER = "other";

export const ROLE_FIELDS = ["is_foss_user", "is_foss_contributor", "is_student"] as const;

export type RoleField = (typeof ROLE_FIELDS)[number];

export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_AMOUNT_LENGTH = 20;
export const MAX_MONTHS_LENGTH = 20;
export const MAX_QUESTION_LENGTH = 100;

export type WaitlistResult =
  | {
      ok: true;
      value: {
        name: string;
        email: string;
        source: WaitlistSource;
        amount: string;
        months: string;
        question: string;
        updates_opt_in: 0 | 1;
      } & Record<RoleField, 0 | 1>;
    }
  | { ok: false; errors: string[] };

function toSource(value: unknown): WaitlistSource {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (WAITLIST_SOURCES as readonly string[]).includes(raw)
    ? (raw as WaitlistSource)
    : DEFAULT_WAITLIST_SOURCE;
}

function checkbox(value: unknown): 0 | 1 {
  return text(value) === "1" ? 1 : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toAmount(body: Record<string, unknown>): string {
  const chosen = text(body.amount);
  if ((AMOUNT_OPTIONS as readonly string[]).includes(chosen)) return chosen;
  if (chosen === AMOUNT_OTHER) return text(body.amount_other);
  return "";
}

export function validateWaitlist(body: unknown): WaitlistResult {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) return { ok: false, errors: ["body"] };
  const b = body as Record<string, unknown>;

  const name = text(b.name);
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) errors.push("name");

  const email = text(b.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LENGTH) errors.push("email");

  const amount = toAmount(b);
  if (amount.length === 0 || amount.length > MAX_AMOUNT_LENGTH) errors.push("amount");

  const months = text(b.months);
  if (months.length > MAX_MONTHS_LENGTH) errors.push("months");

  const question = text(b.question);
  if (question.length > MAX_QUESTION_LENGTH) errors.push("question");

  const updates_opt_in = checkbox(b.updates);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      email,
      source: toSource(b.source),
      amount,
      months,
      question,
      updates_opt_in,
      is_foss_user: checkbox(b.is_foss_user),
      is_foss_contributor: checkbox(b.is_foss_contributor),
      is_student: checkbox(b.is_student),
    },
  };
}
