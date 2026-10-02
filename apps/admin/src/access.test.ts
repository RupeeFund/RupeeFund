import type { ExecutionContext } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireAccess } from "./access.ts";
import { makeCtx, makeEnv, makeLogger } from "./testkit.ts";
import type { AdminEnv, AdminVariables } from "./types.ts";

function makeApp(log: (e: Record<string, unknown>) => void) {
  const app = new Hono<{ Bindings: AdminEnv; Variables: AdminVariables }>();
  app.use("*", requireAccess(log));
  app.get("/probe", async (c) => {
    const identity = await c.get("access").getIdentity();
    return c.json({ email: identity?.email ?? null });
  });
  return app;
}

describe("the Access guard", () => {
  it("refuses a request with no access context", async () => {
    const logger = makeLogger();
    const res = await makeApp(logger.log).request("/probe", {}, makeEnv(), makeCtx());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(logger.entries).toEqual([
      { event: "access_denied", reason: "missing", method: "GET", path: "/probe" },
    ]);
  });

  it("refuses a request with no execution context", async () => {
    const logger = makeLogger();
    const res = await makeApp(logger.log).request("/probe", {}, makeEnv());
    expect(res.status).toBe(403);
    expect(logger.entries).toHaveLength(1);
  });

  it("refuses an access context that carries no audience tag", async () => {
    const logger = makeLogger();
    const ctx = {
      waitUntil() {},
      passThroughOnException() {},
      access: { getIdentity: async () => ({ email: "spoofed@example.org" }) },
    } as unknown as ExecutionContext;
    const res = await makeApp(logger.log).request("/probe", {}, makeEnv(), ctx);
    expect(res.status).toBe(403);
    expect(logger.entries).toHaveLength(1);
  });

  it("refuses an access context issued for another Access application", async () => {
    const logger = makeLogger();
    const ctx = {
      waitUntil() {},
      passThroughOnException() {},
      access: { aud: "other-aud", getIdentity: async () => ({ email: "volunteer@example.org" }) },
    } as unknown as ExecutionContext;
    const res = await makeApp(logger.log).request("/probe", {}, makeEnv(), ctx);
    expect(res.status).toBe(403);
    expect(logger.entries).toEqual([
      { event: "access_denied", reason: "aud", method: "GET", path: "/probe" },
    ]);
  });

  it("refuses every request when no audience is configured", async () => {
    const logger = makeLogger();
    const env = { ...makeEnv(), ACCESS_AUD: "" };
    const ctx = makeCtx({ email: "volunteer@example.org" });
    const res = await makeApp(logger.log).request("/probe", {}, env, ctx);
    expect(res.status).toBe(403);
  });

  it("admits a request that Access authenticated", async () => {
    const logger = makeLogger();
    const ctx = makeCtx({ email: "volunteer@example.org" });
    const res = await makeApp(logger.log).request("/probe", {}, makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "volunteer@example.org" });
    expect(logger.entries).toEqual([]);
  });
});
