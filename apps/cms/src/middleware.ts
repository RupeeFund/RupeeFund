import { defineMiddleware } from "astro:middleware";
import { withSecurityHeaders } from "./headers.ts";
import { plain } from "./public-routes.ts";
import { refusesStranger, SESSION_COOKIE } from "./session-gate.ts";

export const onRequest = defineMiddleware(async ({ url, cookies, session }, next) => {
  const readUser = cookies.has(SESSION_COOKIE) ? async () => session?.get("user") : undefined;
  if (await refusesStranger(url.pathname, readUser)) {
    return withSecurityHeaders(plain(404, "Not found"));
  }
  return withSecurityHeaders(await next());
});
