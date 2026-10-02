import { describe, expect, it, vi } from "vitest";
import { DASHBOARDS } from "./chrome.ts";
import { app } from "./index.ts";
import { makeCtx, makeEnv } from "./testkit.ts";

const REGISTERED = [
  ...new Set(
    app.routes
      .filter((route) => route.method === "GET" && !route.path.includes("*"))
      .map((route) => route.path.replace(/:\w+/g, "1")),
  ),
];
const GUARDED_PATHS = [...REGISTERED, "/nope"];

describe("the admin Worker", () => {
  it("guards every GET route the Worker registers, page and API alike", () => {
    expect(REGISTERED).toContain("/api/questions");
    expect(REGISTERED).toContain("/api/reveal/1");
    for (const entry of DASHBOARDS) expect(REGISTERED).toContain(entry.href);
  });

  for (const path of GUARDED_PATHS) {
    it(`refuses ${path} with no access context`, async () => {
      const res = await app.request(path, {}, makeEnv(), makeCtx());
      expect(res.status).toBe(403);
    });
  }

  it("writes an audit event as info, so the log keeps error for a fault", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await app.request("/api/summary", {}, makeEnv(), makeCtx());
    } finally {
      vi.restoreAllMocks();
    }
    const events = info.mock.calls.map(([line]) => JSON.parse(line).event);
    expect([events, error.mock.calls]).toEqual([["access_denied"], []]);
  });

  it("reaches no query when there is no access context", async () => {
    const env = makeEnv();
    for (const path of GUARDED_PATHS) {
      await app.request(path, {}, env, makeCtx());
    }
    expect(env.DB.queries).toEqual([]);
  });

  it("serves a page for every sidebar item", async () => {
    const ctx = makeCtx({ email: "volunteer@example.org" });
    for (const entry of DASHBOARDS) {
      const res = await app.request(entry.href, {}, makeEnv(), ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.text()).toContain(`<title>${entry.label} —`);
    }
  });

  it("serves the one view alone, so the old records and questions pages are gone", async () => {
    const ctx = makeCtx({ email: "volunteer@example.org" });
    const statuses = [];
    for (const path of ["/records", "/questions"]) {
      statuses.push((await app.request(path, {}, makeEnv(), ctx)).status);
    }
    expect(statuses).toEqual([404, 404]);
  });

  it("returns 404 JSON for an unknown path", async () => {
    const ctx = makeCtx({ email: "volunteer@example.org" });
    const res = await app.request("/nope", {}, makeEnv(), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
