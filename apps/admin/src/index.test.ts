import { describe, expect, it } from "vitest";
import { PAGES } from "./chrome.ts";
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
    for (const entry of PAGES) expect(REGISTERED).toContain(entry.href);
  });

  for (const path of GUARDED_PATHS) {
    it(`refuses ${path} with no access context`, async () => {
      const res = await app.request(path, {}, makeEnv(), makeCtx());
      expect(res.status).toBe(403);
    });
  }

  it("reaches no query when there is no access context", async () => {
    const env = makeEnv();
    for (const path of GUARDED_PATHS) {
      await app.request(path, {}, env, makeCtx());
    }
    expect(env.DB.queries).toEqual([]);
  });

  it("serves a page for every nav item", async () => {
    const ctx = makeCtx({ email: "volunteer@example.org" });
    for (const entry of PAGES) {
      const res = await app.request(entry.href, {}, makeEnv(), ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.text()).toContain(`<title>${entry.label} —`);
    }
  });

  it("answers a trailing slash with the same page, not a 404", async () => {
    const ctx = makeCtx({ email: "volunteer@example.org" });
    const res = await app.request("/records/", {}, makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Records —");
  });

  it("returns 404 JSON for an unknown path", async () => {
    const ctx = makeCtx({ email: "volunteer@example.org" });
    const res = await app.request("/nope", {}, makeEnv(), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
