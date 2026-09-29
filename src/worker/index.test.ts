import { describe, expect, it } from "vitest";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { app } from "./index.ts";
import { makeD1 } from "./testkit.ts";
import type { Env } from "./types.ts";

function makeEnv(over: Partial<Env> = {}): Env {
  return {
    DB: makeD1(),
    ASSETS: {
      fetch: async (input: Request | URL) => {
        const { pathname } = input instanceof URL ? input : new URL(input.url);
        return new Response(`asset:${pathname}`);
      },
    } as unknown as Env["ASSETS"],
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

const LAUNCH_PAGE_REQUESTS = ["/", "/subscribe"] as const;

describe("the mailing-list pages still serve", () => {
  for (const path of LAUNCH_PAGE_REQUESTS) {
    it(`serves ${path} from the assets binding`, async () => {
      const res = await app.request(path, {}, makeEnv(), ctx);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(`asset:${path}`);
    });
  }
});
