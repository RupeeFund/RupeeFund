import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { app } from "./api.ts";
import { makeD1, makeLimiter } from "./testkit.ts";
import type { Env } from "./types.ts";

function makeEnv(over: Partial<Env> = {}): Env {
  return {
    WAITLIST_DB: makeD1(),
    ...over,
  };
}

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext;

describe("worker router (Hono)", () => {
  it("reports ok on /api/health", async () => {
    const res = await app.request("/api/health", {}, makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("sets security headers on /api responses", async () => {
    const res = await app.request("/api/health", {}, makeEnv(), ctx);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  it("forbids caching of /api responses", async () => {
    const res = await app.request("/api/waitlist", { method: "POST" }, makeEnv(), ctx);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 404 JSON for an unknown /api route", async () => {
    const res = await app.request("/api/nope", {}, makeEnv(), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

const REMOVED_API_ROUTES = [
  { method: "POST", path: "/api/subscribe" },
  { method: "POST", path: "/api/subscribe/verify" },
  { method: "POST", path: "/api/webhook/razorpay" },
  { method: "GET", path: "/api/unsubscribe" },
  { method: "GET", path: "/api/metrics" },
  { method: "GET", path: "/api/dataset" },
  { method: "GET", path: "/api/vote/proposals" },
  { method: "POST", path: "/api/vote/cast" },
] as const;

describe("the payment and voting API is gone, not merely gated", () => {
  for (const { method, path } of REMOVED_API_ROUTES) {
    it(`404s ${method} ${path}`, async () => {
      const res = await app.request(path, { method }, makeEnv(), ctx);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    });
  }
});

describe("a signup writes to the waitlist database alone", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the signup while the content database is out of reach", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ success: true, hostname: "rupeefund.org", action: "waitlist_signup" }),
        ),
    );
    const env = makeEnv({
      SIGNUP_LIMITER: makeLimiter() as unknown as Env["SIGNUP_LIMITER"],
      TURNSTILE_SECRET: "test-turnstile",
      TURNSTILE_HOSTNAMES: "rupeefund.org",
      TURNSTILE_ACTION: "waitlist_signup",
    });
    Object.defineProperty(env, "DB", {
      get() {
        throw new Error("the signup read the content database");
      },
    });
    const res = await app.request(
      "/api/waitlist",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Asha",
          email: "asha@example.com",
          amount: "128",
          turnstileToken: "tok",
        }),
      },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });
});
