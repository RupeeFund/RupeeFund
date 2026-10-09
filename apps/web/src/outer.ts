import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { SESSION_COOKIE, authRoute, identityOf, readCookie, signOutCookie } from "@rupeefund/auth";
import { isDenied, notFound, requestPath, signInTarget, withHeaders } from "./lib/edge.ts";
import { ADMIN_ROLE } from "./lib/protect.ts";

const LOGOUT = "/_emdash/api/auth/logout";

const redirect = (location: string): Response =>
  new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });

export const onRequest = defineMiddleware(async ({ url, request, session }, next) => {
  const path = requestPath(url.pathname);
  if (path === null) return withHeaders(url.pathname, notFound());
  const dev = import.meta.env.DEV;
  const origin = env.AUTH_ORIGIN;

  if (!dev) {
    const app = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      org: "RupeeFund",
    };
    const routed = await authRoute(request, { app, secret: env.AUTH_SECRET, origin });
    if (routed !== null) {
      if (path === "/auth/callback" && routed.status === 302) session?.destroy();
      return withHeaders(path, routed);
    }
  }

  const identity = dev ? null : await identityOf(request, env.AUTH_SECRET, origin);
  if (!dev && identity === null) {
    if (readCookie(request, SESSION_COOKIE) !== undefined) session?.destroy();
    const target = signInTarget(request.method, path, request.headers.get("accept") ?? "");
    if (target !== null) return withHeaders(path, redirect(target));
  }
  if (isDenied(path, dev, identity?.role === ADMIN_ROLE)) return withHeaders(path, notFound());

  const response = withHeaders(path, await next());
  if (path === LOGOUT && request.method === "POST") {
    response.headers.append("set-cookie", signOutCookie(origin));
  }
  return response;
});
