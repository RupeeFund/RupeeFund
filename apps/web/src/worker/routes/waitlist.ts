import { json } from "../lib/http.ts";
import { validateWaitlist } from "../lib/validation.ts";
import type { VerifyToken } from "../lib/turnstile.ts";
import type { Repo } from "../types.ts";

export const CONFIRMED_PATH = "/waitlist-confirmed";
export const PROBLEM_PATH = "/waitlist-problem";

const MAX_BODY_BYTES = 8192;
const HONEYPOT_FIELD = "company";
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

export interface WaitlistLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WaitlistDeps {
  repo: Repo;
  now(): number;
  limiter: WaitlistLimiter;
  verifyToken: VerifyToken;
  log(event: Record<string, unknown>): void;
}

type Reply = (status: number, code: string) => Response;

function jsonReply(status: number, code: string): Response {
  return status === 200 ? json(200, { ok: true }) : json(status, { error: code });
}

function redirectReply(status: number, code: string): Response {
  const target = status === 200 ? CONFIRMED_PATH : `${PROBLEM_PATH}?reason=${code}`;
  return new Response(null, { status: 303, headers: { location: target } });
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export class BodyTooLarge extends Error {}

async function readBodyWithin(request: Request, limit: number): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) throw new BodyTooLarge();

  const body = request.body;
  if (body === null) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  return new Blob(chunks).text();
}

function parseFields(raw: string, isForm: boolean): Record<string, unknown> {
  if (!isForm) {
    const body: unknown = JSON.parse(raw);
    if (typeof body !== "object" || body === null) throw new Error("not an object");
    return body as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(raw).entries()) out[key] = value;
  return out;
}

export async function handleWaitlist(request: Request, deps: WaitlistDeps): Promise<Response> {
  const isForm = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .startsWith(FORM_CONTENT_TYPE);
  const reply: Reply = isForm ? redirectReply : jsonReply;

  if (!isSameOrigin(request)) return reply(403, "origin");

  const ip = request.headers.get("cf-connecting-ip") ?? "";
  try {
    const { success } = await deps.limiter.limit({ key: ip });
    if (!success) return reply(429, "rate_limited");
  } catch {
    return reply(429, "rate_limited");
  }

  let fields: Record<string, unknown>;
  try {
    fields = parseFields(await readBodyWithin(request, MAX_BODY_BYTES), isForm);
  } catch (error) {
    if (error instanceof BodyTooLarge) return reply(413, "too_large");
    return reply(400, "invalid_body");
  }

  const honeypot = fields[HONEYPOT_FIELD];
  if (typeof honeypot === "string" && honeypot.trim().length > 0) return reply(200, "ok");

  const result = validateWaitlist(fields);
  if (!result.ok) return reply(400, "invalid_input");

  if (!isForm) {
    const token = typeof fields.turnstileToken === "string" ? fields.turnstileToken : "";
    let verified = false;
    try {
      verified = await deps.verifyToken(token, ip.length > 0 ? ip : null);
    } catch {
      verified = false;
    }
    if (!verified) return reply(403, "bot_check");
  }

  const at = deps.now();
  try {
    await deps.repo.addToWaitlist({
      email: result.value.email,
      name: result.value.name,
      consent_at: at,
      source: result.value.source,
      amount: result.value.amount,
      months: result.value.months,
      question: result.value.question,
      updates_opt_in: result.value.updates_opt_in,
      is_foss_user: result.value.is_foss_user,
      is_foss_contributor: result.value.is_foss_contributor,
      is_student: result.value.is_student,
      created_at: at,
      updated_at: at,
    });
  } catch (error) {
    deps.log({ event: "waitlist_write_failed", message: String(error) });
    return reply(500, "persist_failed");
  }

  return reply(200, "ok");
}
