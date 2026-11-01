import { describe, expect, it } from "vitest";
import { ADMIN_CSP, SECURITY_HEADERS, withSecurityHeaders } from "./headers.ts";
import { callWorker } from "./testkit.ts";
import { waitlistPage } from "./view-waitlist.ts";

describe("the security headers", () => {
  it("names every host the shell needs, and no other", () => {
    expect(ADMIN_CSP).toContain("default-src 'none'");
    expect(ADMIN_CSP).toContain("connect-src 'self'");
    expect(ADMIN_CSP).not.toContain("http");
  });

  it("permits no inline style, because the shell links its stylesheet", () => {
    expect(ADMIN_CSP).toContain("style-src 'self';");
    expect(ADMIN_CSP).toContain("font-src 'self'");
  });

  it("permits the inline script the shell carries", () => {
    expect(waitlistPage()).toContain("<script>");
    expect(ADMIN_CSP).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("refuses to be framed, sniffed or indexed", () => {
    expect(SECURITY_HEADERS["x-frame-options"]).toBe("DENY");
    expect(SECURITY_HEADERS["x-content-type-options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["x-robots-tag"]).toBe("noindex, nofollow");
  });

  it("keeps the status and the body of the response it guards", async () => {
    const guarded = withSecurityHeaders(new Response("hello", { status: 404 }));
    expect(guarded.status).toBe(404);
    expect(await guarded.text()).toBe("hello");
  });

  it("keeps a header the handler already set", () => {
    const guarded = withSecurityHeaders(
      new Response("", { headers: { "cache-control": "private, no-store" } }),
    );
    expect(guarded.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("the Worker entry", () => {
  it("sets the headers on a refusal, not only on a page", async () => {
    const res = await callWorker("/");
    expect(res.status).toBe(403);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it("sets the headers on the shell", async () => {
    const res = await callWorker("/", { email: "volunteer@example.org" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(ADMIN_CSP);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("sets the headers on the summary", async () => {
    const res = await callWorker("/api/summary", { email: "volunteer@example.org" });
    expect(res.status).toBe(200);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });
});
