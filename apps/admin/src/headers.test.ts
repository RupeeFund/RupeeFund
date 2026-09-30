import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_CSP, SECURITY_HEADERS, withSecurityHeaders } from "./headers.ts";
import { render } from "./pages.ts";
import { callWorker } from "./testkit.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(render("/")).toContain("<script>");
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

  it("sets the headers on a summary answered from the cache", async () => {
    const stored = new Map<string, Response>();
    let served = 0;
    vi.stubGlobal("caches", {
      default: {
        match: async (request: Request) => {
          const found = stored.get(request.url);
          if (found !== undefined) served += 1;
          return found?.clone();
        },
        put: async (request: Request, response: Response) => {
          stored.set(request.url, response);
        },
      },
    });

    const reader = { email: "volunteer@example.org" };
    const miss = await callWorker("/api/summary", reader);
    const hit = await callWorker("/api/summary", reader);

    expect(miss.status).toBe(200);
    expect(hit.status).toBe(200);
    expect(served).toBe(1);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(hit.headers.get(name)).toBe(value);
    }
  });
});
