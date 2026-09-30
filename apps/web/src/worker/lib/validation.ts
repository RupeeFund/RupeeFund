import {
  AMOUNT_OPTIONS,
  AMOUNT_OTHER,
  REASON_FIELDS,
  type ReasonField,
  ROLE_FIELDS,
  type RoleField,
  WAITLIST_SOURCES,
  type WaitlistSource,
} from "@rupeefund/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_WAITLIST_SOURCE: WaitlistSource = "subscribe";

export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_AMOUNT_LENGTH = 15;
export const MAX_MONTHS_LENGTH = 20;
export const MAX_QUESTION_LENGTH = 100;

export type WaitlistInput = {
  name: string;
  email: string;
  source: WaitlistSource;
  amount: number;
  months: string;
  question: string;
  updates_opt_in: 0 | 1;
} & Record<RoleField | ReasonField, 0 | 1>;

export type WaitlistResult = { ok: true; value: WaitlistInput } | { ok: false; errors: string[] };

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

function toAmount(body: Record<string, unknown>): number | null {
  const chosen = text(body.amount);
  const option = AMOUNT_OPTIONS.find((o) => String(o) === chosen);
  if (option !== undefined) return option;
  if (chosen !== AMOUNT_OTHER) return null;
  const digits = text(body.amount_other).replace(/[₹,\s]/g, "");
  if (digits.length > MAX_AMOUNT_LENGTH || !/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return amount >= 1 ? amount : null;
}

function boxes<F extends string>(
  body: Record<string, unknown>,
  fields: readonly F[],
): Record<F, 0 | 1> {
  return Object.fromEntries(fields.map((field) => [field, checkbox(body[field])])) as Record<
    F,
    0 | 1
  >;
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
  if (amount === null) errors.push("amount");

  const months = text(b.months);
  if (months.length > MAX_MONTHS_LENGTH) errors.push("months");

  const question = text(b.question);
  if (question.length > MAX_QUESTION_LENGTH) errors.push("question");

  const updates_opt_in = checkbox(b.updates);

  if (errors.length > 0 || amount === null) return { ok: false, errors };
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
      ...boxes(b, ROLE_FIELDS),
      ...boxes(b, REASON_FIELDS),
    },
  };
}
