const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-robots-tag": "noindex, nofollow",
};

export function withSecurityHeaders(response: Response): Response {
  const guarded = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    guarded.headers.set(name, value);
  }
  return guarded;
}
