import type { APIContext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { env, waitUntil } from "cloudflare:workers";
import type {} from "emdash/internal/middleware/auth";
import { forbidden, notFound, privately, requestPath } from "./lib/edge.ts";
import { isMediaAsset, isMediaFile, locksSchema, mediaKey } from "./lib/guard.ts";
import { activeUser, type Query } from "./lib/guard-store.ts";
import { ADMIN_ROLE, isPublic, refusesWrite, sessionUserId } from "./lib/protect.ts";

const SCHEMA_LOCKED = "Change the schema with an API token";

const ADMIN_ONLY = "Only an admin can change this. Ask an admin for the change.";

const query: Query = async (sql, params) =>
  (
    await env.DB.prepare(sql)
      .bind(...params)
      .all<Record<string, unknown>>()
  ).results;

async function termOf(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.clone().json();
    const term = (body as { termId?: unknown } | null)?.termId;
    return typeof term === "string" ? term : null;
  } catch {
    return null;
  }
}

async function signedIn({ locals, session }: APIContext): Promise<boolean> {
  if (locals.user) return !locals.user.disabled;
  const id = await sessionUserId(session, waitUntil);
  if (id === null) return false;
  return activeUser(query, id).catch(() => false);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, locals, url } = context;
  const path = requestPath(url.pathname);
  if (path === null) return notFound();
  const { method } = request;
  if (locksSchema(method, path, locals.tokenId !== undefined)) return forbidden(SCHEMA_LOCKED);
  const role = locals.user?.role;
  if (role !== undefined && role < ADMIN_ROLE) {
    if (await refusesWrite(query, method, path, () => termOf(request)))
      return forbidden(ADMIN_ONLY);
  }
  if (isMediaAsset(path)) return privately(await next());
  if (path === "/_image") return (await signedIn(context)) ? privately(await next()) : notFound();
  if (!isMediaFile(path)) return next();
  const key = mediaKey(path);
  if (key !== null && (await isPublic(query, key))) return next();
  return (await signedIn(context)) ? privately(await next()) : notFound();
});
