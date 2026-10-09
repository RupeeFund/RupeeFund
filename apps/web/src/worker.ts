import { handle } from "@astrojs/cloudflare/handler";
import { app } from "./worker/api.ts";
import { route } from "./worker/route.ts";

export default {
  fetch: route(app.fetch, handle),
  scheduled(_controller, _env, ctx) {
    ctx.waitUntil(
      import("emdash/middleware")
        .then(({ runScheduledTasks }) => runScheduledTasks())
        .catch((error: unknown) => console.error("[scheduled] EmDash maintenance failed:", error)),
    );
  },
} satisfies ExportedHandler<Env>;
