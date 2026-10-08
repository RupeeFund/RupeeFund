import { json } from "../lib/http.ts";
import { validateWaitlist } from "../lib/validation.ts";
import type { VerifyToken } from "../lib/turnstile.ts";
import type { Repo } from "../types.ts";

const MAX_BODY_BYTES = 8192;
const HONEYPOT_FIELD = "company";
const JSON_CONTENT_TYPE = "application/json";

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

function reply(status: number, code: string): Response {
  return status === 200 ? json(200, { ok: true }) : json(status, { error: code });
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
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function parseFields(raw: string): Record<string, unknown> {
  const body: unknown = JSON.parse(raw);
  if (typeof body !== "object" || body === null) throw new Error("not an object");
  return body as Record<string, unknown>;
}

export async function handleWaitlist(request: Request, deps: WaitlistDeps): Promise<Response> {
  const isJson = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .startsWith(JSON_CONTENT_TYPE);
  if (!isJson) return reply(415, "unsupported_type");

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
    fields = parseFields(await readBodyWithin(request, MAX_BODY_BYTES));
  } catch (error) {
    if (error instanceof BodyTooLarge) return reply(413, "too_large");
    return reply(400, "invalid_body");
  }

  const honeypot = fields[HONEYPOT_FIELD];
  if (typeof honeypot === "string" && honeypot.trim().length > 0) return reply(200, "ok");

  const result = validateWaitlist(fields);
  if (!result.ok) return reply(400, "invalid_input");

  const token = typeof fields.turnstileToken === "string" ? fields.turnstileToken : "";
  let verified = false;
  try {
    verified = await deps.verifyToken(token, ip.length > 0 ? ip : null);
  } catch {
    verified = false;
  }
  if (!verified) return reply(403, "bot_check");

  const at = deps.now();
  try {
    await deps.repo.addToWaitlist({
      ...result.value,
      consent_at: at,
      created_at: at,
      updated_at: at,
    });
  } catch (error) {
    deps.log({ event: "waitlist_write_failed", message: String(error) });
    return reply(500, "persist_failed");
  }

  return reply(200, "ok");
}
