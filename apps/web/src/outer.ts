import { defineMiddleware } from "astro:middleware";
import { isDenied, notFound, requestPath, withHeaders } from "./lib/edge.ts";

export const onRequest = defineMiddleware(async ({ url }, next) => {
  const path = requestPath(url.pathname);
  if (path === null || isDenied(path, import.meta.env.DEV)) {
    return withHeaders(path ?? url.pathname, notFound());
  }
  return withHeaders(path, await next());
});
