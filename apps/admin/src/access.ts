import type { CloudflareAccessContext } from "@cloudflare/workers-types";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { AdminEnv, AdminLogger, AdminVariables } from "./types.ts";

type AdminBindings = { Bindings: AdminEnv; Variables: AdminVariables };

function readAccess(c: Context<AdminBindings>): CloudflareAccessContext | undefined {
  try {
    return (c.executionCtx as { access?: CloudflareAccessContext }).access;
  } catch {
    return undefined;
  }
}

export function requireAccess(log: AdminLogger): MiddlewareHandler<AdminBindings> {
  return createMiddleware<AdminBindings>(async (c, next) => {
    const access = readAccess(c);
    const audience = c.env.ACCESS_AUD;
    const reason =
      access === undefined ? "missing" : !audience || access.aud !== audience ? "aud" : null;
    if (access === undefined || reason !== null) {
      log({
        event: "access_denied",
        reason,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
      });
      return c.json({ error: "forbidden" }, 403);
    }

    c.set("access", access);
    await next();
  });
}
