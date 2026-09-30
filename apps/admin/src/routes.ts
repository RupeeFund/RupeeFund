import type { Context } from "hono";
import type { AdminRepo } from "./repo.ts";
import { PAGE_SIZE } from "./sql.ts";
import type { AdminEnv, AdminLogger, AdminVariables } from "./types.ts";

export const SUMMARY_MAX_AGE = 60;
export const NO_STORE = "private, no-store";

export interface SummaryCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface RouteDeps {
  repo: AdminRepo;
  cache: SummaryCache;
  log: AdminLogger;
}

type AdminContext = Context<{ Bindings: AdminEnv; Variables: AdminVariables }>;

const PRIVATE = { "cache-control": NO_STORE } as const;

function summaryKey(url: string): Request {
  return new Request(new URL("/api/summary", url).toString(), { method: "GET" });
}

function parseId(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim().length === 0) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return undefined;
  return value;
}

export async function handleSummary(c: AdminContext, deps: RouteDeps): Promise<Response> {
  const key = summaryKey(c.req.url);
  const hit = await deps.cache.match(key);
  if (hit !== undefined) return hit;

  const summary = await deps.repo.summary();
  const response = c.json(summary, 200, { "cache-control": `max-age=${SUMMARY_MAX_AGE}` });
  await deps.cache.put(key, response.clone());
  return response;
}

async function pageFrom(
  c: AdminContext,
  read: (before: number) => Promise<{ id: number }[]>,
): Promise<Response> {
  const raw = c.req.query("before");
  const before = raw === undefined ? Number.MAX_SAFE_INTEGER : parseId(raw);
  if (before === undefined) return c.json({ error: "bad_cursor" }, 400, PRIVATE);

  const rows = await read(before);
  const next = rows.length === PAGE_SIZE ? (rows.at(-1)?.id ?? null) : null;
  return c.json({ rows, next }, 200, PRIVATE);
}

export function handleWaitlist(c: AdminContext, deps: RouteDeps): Promise<Response> {
  return pageFrom(c, (before) => deps.repo.page(before));
}

export function handleQuestions(c: AdminContext, deps: RouteDeps): Promise<Response> {
  return pageFrom(c, (before) => deps.repo.questions(before));
}

export async function handleReveal(c: AdminContext, deps: RouteDeps): Promise<Response> {
  const id = parseId(c.req.param("id"));
  if (id === undefined) return c.json({ error: "bad_id" }, 400, PRIVATE);

  const identity = await c.get("access").getIdentity();
  const actor = identity?.email;
  if (actor === undefined || actor.length === 0) {
    deps.log({ event: "reveal_denied", reason: "identity_has_no_email", id });
    return c.json({ error: "forbidden" }, 403, PRIVATE);
  }

  const email = await deps.repo.reveal(id);
  if (email === null) {
    deps.log({ event: "reveal_miss", actor, id });
    return c.json({ error: "not_found" }, 404, PRIVATE);
  }

  deps.log({ event: "reveal", actor, id });
  return c.json({ id, email }, 200, PRIVATE);
}
