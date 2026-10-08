import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createRepo } from "./lib/db.ts";
import { createTurnstile, parseHostnames } from "./lib/turnstile.ts";
import { handleWaitlist, type WaitlistLimiter } from "./routes/waitlist.ts";
import type { Env } from "./types.ts";

export const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
    xFrameOptions: "DENY",
  }),
);

app.use("/api/*", async (c, next) => {
  await next();
  c.header("cache-control", "no-store");
});

app.get("/api/health", (c) => c.json({ ok: true }));

const DENY_ALL_LIMITER: WaitlistLimiter = {
  limit: async () => ({ success: false }),
};

app.post("/api/waitlist", (c) =>
  handleWaitlist(c.req.raw, {
    repo: createRepo(c.env.WAITLIST_DB),
    now: () => Date.now(),
    limiter: c.env.SIGNUP_LIMITER ?? DENY_ALL_LIMITER,
    verifyToken: createTurnstile(c.env.TURNSTILE_SECRET ?? "", {
      hostnames: parseHostnames(c.env.TURNSTILE_HOSTNAMES),
      action: c.env.TURNSTILE_ACTION ?? "",
    }),
    log: (event) => console.error(JSON.stringify(event)),
  }),
);

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));
