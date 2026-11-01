import {
  AMOUNT_OPTIONS,
  AMOUNT_OTHER,
  REASON_FIELDS,
  type ReasonField,
  ROLE_FIELDS,
  type RoleField,
  type WaitlistSource,
} from "@rupeefund/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SIGNUP_SOURCE: WaitlistSource = "subscribe";

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

function toEmail(value: unknown): string | null {
  const raw = text(value).normalize("NFC").toLowerCase();
  if (/[\p{Cc}\p{Cf}]/u.test(raw)) return null;
  const at = raw.lastIndexOf("@");
  const domain = raw.slice(at + 1);
  if (at < 1 || /[/?#:\\[\]%]/.test(domain)) return null;
  let host: string;
  try {
    host = new URL(`http://${domain}`).hostname;
  } catch {
    return null;
  }
  const email = `${raw.slice(0, at)}@${host}`;
  return EMAIL_RE.test(email) && email.length <= MAX_EMAIL_LENGTH ? email : null;
}

function toName(value: unknown): string | null {
  const name = text(value);
  if (/\p{Cc}/u.test(name) || name.replace(/\p{Cf}/gu, "").trim().length === 0) return null;
  return name.length <= MAX_NAME_LENGTH ? name : null;
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

  const name = toName(b.name);
  if (name === null) errors.push("name");

  const email = toEmail(b.email);
  if (email === null) errors.push("email");

  const amount = toAmount(b);
  if (amount === null) errors.push("amount");

  const months = text(b.months);
  if (months.length > MAX_MONTHS_LENGTH) errors.push("months");

  const question = text(b.question);
  if (question.length > MAX_QUESTION_LENGTH) errors.push("question");

  const updates_opt_in = checkbox(b.updates);

  if (errors.length > 0 || name === null || email === null || amount === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      name,
      email,
      source: SIGNUP_SOURCE,
      amount,
      months,
      question,
      updates_opt_in,
      ...boxes(b, ROLE_FIELDS),
      ...boxes(b, REASON_FIELDS),
    },
  };
}
