const TURNSTILE = "https://challenges.cloudflare.com";

export const SITE_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://github.com https://avatars.githubusercontent.com",
  `connect-src 'self' ${TURNSTILE}`,
  `frame-src ${TURNSTILE}`,
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const EVERY_RESPONSE: Readonly<Record<string, string>> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

const DENIED_TREES = [
  "/_emdash/api/oauth",
  "/_emdash/oauth",
  "/_emdash/.well-known",
  "/_emdash/api/import",
  "/_emdash/api/admin/transfer",
];

const SET_UP_TREES = ["/_emdash/api/setup", "/_emdash/admin/setup"];

const ADMIN_SET_UP = new Set([
  "/_emdash/api/setup",
  "/_emdash/api/setup/status",
  "/_emdash/admin/setup",
]);

const DENIED_PATHS = new Set([
  "/_emdash/api/snapshot",
  "/_emdash/api/typegen",
  "/_emdash/api/site/domain-proof",
  "/_emdash/api/health",
]);

const DENIED_PATTERNS = [/^\/\.well-known\/oauth-/, /^\/sitemap-[^/]+\.xml$/];

const inTree = (path: string, tree: string): boolean =>
  path === tree || path.startsWith(`${tree}/`);

export function requestPath(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const path = decoded.replace(/\/{2,}/g, "/");
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isDenied(path: string, dev: boolean, admin = false): boolean {
  if (DENIED_PATHS.has(path)) return true;
  if (DENIED_PATTERNS.some((pattern) => pattern.test(path))) return true;
  if (DENIED_TREES.some((tree) => inTree(path, tree))) return true;
  if (dev || (admin && ADMIN_SET_UP.has(path))) return false;
  return SET_UP_TREES.some((tree) => inTree(path, tree));
}

export function signInTarget(method: string, path: string, accept: string): string | null {
  if (method !== "GET" || !accept.includes("text/html") || !inTree(path, "/_emdash/admin"))
    return null;
  return inTree(path, "/_emdash/admin/login") ? "/" : "/auth/login";
}

export function withHeaders(path: string, response: Response): Response {
  const answer = new Response(response.body, response);
  for (const [name, value] of Object.entries(EVERY_RESPONSE)) answer.headers.set(name, value);
  if (inTree(path, "/_emdash")) {
    answer.headers.set("x-robots-tag", "noindex, nofollow");
    return answer;
  }
  if (!answer.headers.has("content-security-policy")) {
    answer.headers.set("content-security-policy", SITE_CSP);
  }
  answer.headers.set("x-frame-options", "DENY");
  return answer;
}

export const notFound = (): Response =>
  new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

export const forbidden = (message: string): Response =>
  Response.json(
    { success: false, error: { code: "FORBIDDEN", message } },
    { status: 403, headers: { "cache-control": "private, no-store" } },
  );

export function privately(response: Response): Response {
  const answer = new Response(response.body, response);
  answer.headers.set("cache-control", "private, no-store");
  return answer;
}
