import { describe, expect, it } from "vitest";
import { runChecks, type Fetch } from "../scripts/live-check.mts";

const SITE = "https://site.test";
const ADMIN = "https://admin.test";
const SECURE = {
  "content-security-policy": "default-src 'self'",
  "strict-transport-security": "max-age=63072000",
};

type Route = () => Response;

const toAccess: Route = () =>
  new Response(null, {
    status: 302,
    headers: { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login/admin.test" },
  });

function healthy(): Record<string, Route> {
  return {
    [`${SITE}/api/health`]: () => Response.json({ ok: true }),
    [`${SITE}/subscribe`]: () => new Response('<div data-sitekey="0x4AAAAreal"></div>'),
    [`${SITE}/`]: () => new Response("<html></html>", { headers: SECURE }),
    [`${SITE}/logo.svg`]: () => new Response("<svg/>"),
    [`${SITE}/favicon.svg`]: () => new Response("<svg/>"),
    [`${ADMIN}/`]: toAccess,
    [`${ADMIN}/api/summary`]: toAccess,
  };
}

function serve(routes: Record<string, Route>): Fetch {
  return async (url) => {
    const route = routes[url];
    if (route === undefined) throw new TypeError(`fetch failed: ${url}`);
    return route();
  };
}

async function failed(routes: Record<string, Route>): Promise<string[]> {
  const checks = await runChecks(SITE, ADMIN, serve(routes));
  return checks.filter((check) => !check.ok).map((check) => check.name);
}

describe("the live check", () => {
  it("passes a healthy site and an admin panel that refuses a stranger", async () => {
    expect(await failed(healthy())).toEqual([]);
  });

  it("fails when the health check does not answer ok", async () => {
    const routes = { ...healthy(), [`${SITE}/api/health`]: () => Response.json({ ok: false }) };
    expect(await failed(routes)).toEqual(["site health"]);
  });

  it("fails when the signup form carries a test sitekey", async () => {
    const routes = {
      ...healthy(),
      [`${SITE}/subscribe`]: () => new Response('<div data-sitekey="1x00000000000000000000AA">'),
    };
    expect(await failed(routes)).toEqual(["site sitekey"]);
  });

  it("fails when the signup form carries an empty sitekey", async () => {
    const routes = {
      ...healthy(),
      [`${SITE}/subscribe`]: () => new Response('<div data-sitekey="">'),
    };
    expect(await failed(routes)).toEqual(["site sitekey"]);
  });

  it("fails both admin lines when the Worker refuses alone, with no Access", async () => {
    const forbidden: Route = () => Response.json({ error: "forbidden" }, { status: 403 });
    const routes = { ...healthy(), [`${ADMIN}/`]: forbidden, [`${ADMIN}/api/summary`]: forbidden };
    expect(await failed(routes)).toEqual(["admin refuses the page", "admin refuses the counts"]);
  });

  it("fails an admin line that redirects anywhere but Cloudflare Access", async () => {
    const elsewhere: Route = () =>
      new Response(null, { status: 302, headers: { location: "https://evil.example/login" } });
    const routes = { ...healthy(), [`${ADMIN}/`]: elsewhere };
    expect(await failed(routes)).toEqual(["admin refuses the page"]);
  });

  it("fails when the signup form carries no sitekey", async () => {
    const routes = { ...healthy(), [`${SITE}/subscribe`]: () => new Response("<form></form>") };
    expect(await failed(routes)).toEqual(["site sitekey"]);
  });

  it("fails when the home page lacks the security headers", async () => {
    const routes = { ...healthy(), [`${SITE}/`]: () => new Response("<html></html>") };
    expect(await failed(routes)).toEqual(["site security headers"]);
  });

  it("fails when a brand file is missing", async () => {
    const routes = {
      ...healthy(),
      [`${SITE}/favicon.svg`]: () => new Response(null, { status: 404 }),
    };
    expect(await failed(routes)).toEqual(["site brand files"]);
  });

  it("fails when the admin panel serves a page to a stranger", async () => {
    const routes = { ...healthy(), [`${ADMIN}/`]: () => new Response("<html></html>") };
    expect(await failed(routes)).toEqual(["admin refuses the page"]);
  });

  it("fails when the admin panel sends the counts to a stranger", async () => {
    const routes = {
      ...healthy(),
      [`${ADMIN}/api/summary`]: () => Response.json({ totals: { total: 1 } }),
    };
    expect(await failed(routes)).toEqual(["admin refuses the counts"]);
  });

  it("fails each check that cannot reach its host", async () => {
    const routes = healthy();
    delete routes[`${ADMIN}/`];
    delete routes[`${ADMIN}/api/summary`];
    expect(await failed(routes)).toEqual(["admin refuses the page", "admin refuses the counts"]);
  });
});
