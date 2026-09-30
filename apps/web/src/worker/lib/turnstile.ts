const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
const SITEVERIFY_TIMEOUT_MS = 10_000;

export type VerifyToken = (token: string, remoteIp: string | null) => Promise<boolean>;

export interface TurnstileChecks {
  hostnames: readonly string[];
  action: string;
}

interface SiteverifyResponse {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
}

export function parseHostnames(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);
}

export function createTurnstile(
  secret: string,
  checks: TurnstileChecks,
  fetchImpl: typeof fetch = fetch,
): VerifyToken {
  return async (token, remoteIp) => {
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return false;

    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp !== null && remoteIp.length > 0) body.set("remoteip", remoteIp);

    const res = await fetchImpl(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const parsed = (await res.json()) as SiteverifyResponse;
    if (parsed.success !== true) return false;
    if (checks.action.length > 0 && parsed.action !== checks.action) return false;
    if (checks.hostnames.length > 0 && !checks.hostnames.includes(String(parsed.hostname)))
      return false;
    return true;
  };
}
