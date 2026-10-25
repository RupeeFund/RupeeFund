import type { APIContext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { env, waitUntil } from "cloudflare:workers";
import type {} from "emdash/internal/middleware/auth";
import { pageCache, sharesAnswer, sharesRequest } from "./lib/cache.ts";
import { forbidden, notFound, privately, requestPath, unavailable } from "./lib/edge.ts";
import { ADMIN_ROLE, isMediaAsset, isMediaFile, locksSchema, mediaKey } from "./lib/guard.ts";
import { activeUser, type Query } from "./lib/guard-store.ts";
import { deletesLegalPage, isPublic, refusesWrite, sessionUserId } from "./lib/protect.ts";

const SCHEMA_LOCKED = "Change the schema with an API token";

const ADMIN_ONLY = "Only an admin can change this. Ask an admin for the change.";

const LEGAL_DELETE = "Nobody deletes a legal page. Change its kind to page first.";

const NO_DATABASE = "The content database did not answer. Try again in a minute.";

const query: Query = async (sql, params) =>
  (
    await env.DB.prepare(sql)
      .bind(...params)
      .all<Record<string, unknown>>()
  ).results;

const stored = async (key: string): Promise<boolean> => (await env.MEDIA.head(key)) !== null;

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
  if (role !== undefined) {
    try {
      if (await deletesLegalPage(query, method, path)) return forbidden(LEGAL_DELETE);
      if (role < ADMIN_ROLE && (await refusesWrite(query, method, path, () => termOf(request))))
        return forbidden(ADMIN_ONLY);
    } catch {
      return unavailable(NO_DATABASE);
    }
  }
  if (isMediaAsset(path)) return privately(await next());
  if (path === "/_image") return (await signedIn(context)) ? privately(await next()) : notFound();
  if (!isMediaFile(path)) {
    const member = locals.user !== undefined;
    const read = { method, path, search: url.search, signedIn: member };
    const shared = context.cache.enabled && sharesRequest(read);
    if (shared) context.cache.set(pageCache(context.routePattern));
    const response = await next();
    if (!shared) return response;
    if (!sharesAnswer(response)) {
      context.cache.set(false);
      return response;
    }
    return new Response(await response.arrayBuffer(), response);
  }
  const key = mediaKey(path);
  if (key !== null && (await isPublic(query, key, stored))) return next();
  return (await signedIn(context)) ? privately(await next()) : notFound();
});
