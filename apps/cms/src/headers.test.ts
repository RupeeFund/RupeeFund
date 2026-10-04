import { describe, expect, it } from "vitest";
import { withSecurityHeaders } from "./headers.ts";

describe("the cms security headers", () => {
  it("refuses to be sniffed, indexed or framed by another site", () => {
    const guarded = withSecurityHeaders(new Response("ok"));
    expect(guarded.headers.get("x-content-type-options")).toBe("nosniff");
    expect(guarded.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(guarded.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(guarded.headers.get("strict-transport-security")).toContain("max-age=63072000");
  });

  it("keeps the policy EmDash sets for its admin", () => {
    const guarded = withSecurityHeaders(
      new Response("", { headers: { "content-security-policy": "default-src 'self'" } }),
    );
    expect(guarded.headers.get("content-security-policy")).toBe("default-src 'self'");
  });

  it("keeps the status and the body", async () => {
    const guarded = withSecurityHeaders(new Response("gone", { status: 404 }));
    expect(guarded.status).toBe(404);
    expect(await guarded.text()).toBe("gone");
  });
});
