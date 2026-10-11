import { handle } from "@astrojs/cloudflare/handler";
import { app } from "./worker/api.ts";
import { maintain } from "./worker/maintenance.ts";
import { route } from "./worker/route.ts";

export default {
  fetch: route(app.fetch, handle),
  scheduled(_controller, _env, ctx) {
    const run = async () => (await import("emdash/middleware")).runScheduledTasks();
    ctx.waitUntil(maintain(run, new Date()));
  },
} satisfies ExportedHandler<Env>;
