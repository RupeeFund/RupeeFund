import { describe, expect, it } from "vitest";
import {
  editModeReset,
  isDenied,
  requestPath,
  signInTarget,
  SITE_CSP,
  withHeaders,
} from "./edge.ts";

describe("requestPath", () => {
  it.each([
    ["/_emdash/api/health", "/_emdash/api/health"],
    ["/_emdash//api///health", "/_emdash/api/health"],
    ["/_emdash/api/%68ealth", "/_emdash/api/health"],
    ["/_emdash/api/health%2F", "/_emdash/api/health"],
    ["/_emdash/api/health/", "/_emdash/api/health"],
    ["/", "/"],
  ])("reads %s as %s, the path that the router matches", (raw, path) => {
    expect(requestPath(raw)).toBe(path);
  });

  it("refuses a path that does not decode", () => {
    expect(requestPath("/_emdash/api/%E0%A4%A")).toBeNull();
  });
});

describe("isDenied", () => {
  it.each([
    "/_emdash/api/oauth/register",
    "/_emdash/api/oauth/token",
    "/_emdash/api/oauth/device/code",
    "/_emdash/oauth/authorize",
    "/_emdash/.well-known/auth",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-authorization-server/_emdash",
    "/_emdash/api/setup",
    "/_emdash/api/setup/status",
    "/_emdash/api/setup/admin",
    "/_emdash/api/setup/dev-bypass",
    "/_emdash/admin/setup",
    "/_emdash/api/snapshot",
    "/_emdash/api/import/probe",
    "/_emdash/api/import/wordpress/execute",
    "/_emdash/api/admin/transfer/start",
    "/_emdash/api/typegen",
    "/_emdash/api/site/domain-proof",
    "/_emdash/api/health",
    "/sitemap-posts.xml",
    "/sitemap-pages.xml",
  ])("denies %s, which no one here uses", (path) => {
    expect(isDenied(path, false)).toBe(true);
  });

  it.each([
    "/",
    "/blog",
    "/sitemap.xml",
    "/robots.txt",
    "/media/01M42CODE00000000000000000.jpg",
    "/_emdash/admin",
    "/_emdash/admin/login",
    "/_emdash/admin/setupx",
    "/_emdash/api/auth/passkey/options",
    "/_emdash/api/auth/oauth/github",
    "/_emdash/api/content/posts",
    "/_emdash/api/schema/collections",
    "/_emdash/api/media/file/01M42CODE00000000000000000.jpg",
    "/_emdash/api/healthcheck",
    "/.well-known/security.txt",
  ])("allows %s", (path) => {
    expect(isDenied(path, false)).toBe(false);
  });

  it.each(["/_emdash/api/setup", "/_emdash/api/setup/status", "/_emdash/admin/setup"])(
    "allows the set-up step %s to a signed-in admin",
    (path) => {
      expect(isDenied(path, false, true)).toBe(false);
    },
  );

  it.each([
    "/_emdash/api/setup/admin",
    "/_emdash/api/setup/dev-bypass",
    "/_emdash/api/setup/dev-reset",
  ])("denies %s even to a signed-in admin", (path) => {
    expect(isDenied(path, false, true)).toBe(true);
  });

  it("allows set-up under astro dev, where a new local database needs its first Admin", () => {
    expect(isDenied("/_emdash/api/setup/admin", true)).toBe(false);
    expect(isDenied("/_emdash/admin/setup", true)).toBe(false);
    expect(isDenied("/_emdash/api/oauth/register", true)).toBe(true);
  });
});

describe("signInTarget", () => {
  const html = "text/html,application/xhtml+xml";

  it.each(["/_emdash/admin", "/_emdash/admin/content/posts"])(
    "sends a visitor who opens %s to the GitHub sign-in",
    (path) => {
      expect(signInTarget("GET", path, html)).toBe("/auth/login");
    },
  );

  it("sends a visitor who just signed out home, not back through GitHub", () => {
    expect(signInTarget("GET", "/_emdash/admin/login", html)).toBe("/");
  });

  it.each([
    ["GET", "/_emdash/api/auth/me", "application/json"],
    ["GET", "/_emdash/admin", "*/*"],
    ["POST", "/_emdash/admin", html],
    ["GET", "/_emdash/adminx", html],
    ["GET", "/blog", html],
  ])("leaves %s %s (%s) to the content manager", (method, path, accept) => {
    expect(signInTarget(method, path, accept)).toBeNull();
  });
});

describe("editModeReset", () => {
  const url = new URL("https://rupeefund.org/faq?page=2");

  it.each(["GET", "HEAD"])("sends a %s with an old edit cookie back without it", (method) => {
    const reset = editModeReset(method, url, true);
    expect(reset?.status).toBe(302);
    expect(reset?.headers.get("location")).toBe("/faq?page=2");
    expect(reset?.headers.get("set-cookie")).toBe("emdash-edit-mode=; Path=/; Max-Age=0");
    expect(reset?.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["GET", false],
    ["POST", true],
  ])("leaves a %s with edit cookie %s alone", (method, editCookie) => {
    expect(editModeReset(method, url, editCookie)).toBeNull();
  });
});

describe("withHeaders", () => {
  const page = () =>
    withHeaders("/faq", new Response("<p>x</p>", { headers: { "x-frame-options": "SAMEORIGIN" } }));

  it("gives a site page the site policy and refuses framing", () => {
    expect(page().headers.get("content-security-policy")).toBe(SITE_CSP);
    expect(page().headers.get("x-frame-options")).toBe("DENY");
  });

  it("keeps a policy that the route set itself", () => {
    const own = "default-src 'none'; sandbox";
    const file = withHeaders(
      "/media/a.jpg",
      new Response("x", { headers: { "content-security-policy": own } }),
    );
    expect(file.headers.get("content-security-policy")).toBe(own);
  });

  it("asks every browser to use HTTPS and not to guess types", () => {
    for (const path of ["/", "/_emdash/admin"]) {
      const headers = withHeaders(path, new Response("x")).headers;
      expect(headers.get("strict-transport-security")).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
      expect(headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("keeps the content manager out of search engines and leaves its own policy alone", () => {
    const admin = withHeaders(
      "/_emdash/admin",
      new Response("x", { headers: { "content-security-policy": "default-src 'self'" } }),
    );
    expect(admin.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(admin.headers.get("content-security-policy")).toBe("default-src 'self'");
  });

  it("keeps the site pages in search engines", () => {
    expect(page().headers.has("x-robots-tag")).toBe(false);
  });

  it("works on a response whose headers cannot change", async () => {
    const fixed = Response.redirect("https://rupeefund.org/faq", 301);
    const answer = withHeaders("/old", fixed);
    expect(answer.status).toBe(301);
    expect(answer.headers.get("location")).toBe("https://rupeefund.org/faq");
    expect(answer.headers.get("content-security-policy")).toBe(SITE_CSP);
  });
});
