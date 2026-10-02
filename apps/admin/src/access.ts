import type { CloudflareAccessContext } from "@cloudflare/workers-types";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { AdminEnv, AdminLogger, AdminVariables } from "./types.ts";

type AdminBindings = { Bindings: AdminEnv; Variables: AdminVariables };

function readExecutionCtx(c: Context<AdminBindings>): unknown {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

function readAccess(source: unknown): CloudflareAccessContext | undefined {
  if (typeof source !== "object" || source === null) return undefined;
  const { access } = source as { access?: CloudflareAccessContext };
  if (typeof access?.aud !== "string" || access.aud.length === 0) return undefined;
  if (typeof access.getIdentity !== "function") return undefined;
  return access;
}

export function requireAccess(log: AdminLogger): MiddlewareHandler<AdminBindings> {
  return createMiddleware<AdminBindings>(async (c, next) => {
    const access = readAccess(readExecutionCtx(c));
    const reason =
      access === undefined ? "missing" : access.aud !== c.env.ACCESS_AUD ? "aud" : null;
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
