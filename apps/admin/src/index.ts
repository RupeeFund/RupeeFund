import { Hono } from "hono";
import { requireAccess } from "./access.ts";
import { asset } from "./assets.ts";
import { DASHBOARDS } from "./chrome.ts";
import { withSecurityHeaders } from "./headers.ts";
import { render } from "./pages.ts";
import { createAdminRepo } from "./repo.ts";
import {
  handleExport,
  handleQuestions,
  handleReveal,
  handleSummary,
  handleWaitlist,
  NO_STORE,
  type RouteDeps,
} from "./routes.ts";
import type { AdminEnv, AdminVariables } from "./types.ts";

export const app = new Hono<{ Bindings: AdminEnv; Variables: AdminVariables }>({ strict: false });

const log = (event: Record<string, unknown>) => console.info(JSON.stringify(event));

app.use("*", requireAccess(log));

function deps(env: AdminEnv): RouteDeps {
  return {
    repo: createAdminRepo(env.DB),
    cache: {
      match: (request) => caches.default.match(request),
      put: (request, response) => caches.default.put(request, response),
      delete: (request) => caches.default.delete(request),
    },
    log,
  };
}

for (const entry of DASHBOARDS) {
  app.get(entry.href, (c) => c.html(render(entry.href), 200, { "cache-control": NO_STORE }));
}

app.get("/assets/:name", (c) => asset(c.req.path) ?? c.json({ error: "not_found" }, 404));

app.get("/api/summary", (c) => handleSummary(c, deps(c.env)));
app.get("/api/waitlist", (c) => handleWaitlist(c, deps(c.env)));
app.get("/api/questions", (c) => handleQuestions(c, deps(c.env)));
app.get("/api/reveal/:id", (c) => handleReveal(c, deps(c.env)));
app.post("/api/export", (c) => handleExport(c, deps(c.env)));

app.all("*", (c) => c.json({ error: "not_found" }, 404));

export default {
  async fetch(request: Request, env: AdminEnv, ctx: ExecutionContext): Promise<Response> {
    return withSecurityHeaders(await app.fetch(request, env, ctx));
  },
};
