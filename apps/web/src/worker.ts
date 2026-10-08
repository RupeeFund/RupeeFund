import { handle } from "@astrojs/cloudflare/handler";
import { app } from "./worker/api.ts";
import { route } from "./worker/route.ts";

export default {
  fetch: route(app.fetch, handle),
};
