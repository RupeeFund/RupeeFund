import { describe, expect, it } from "vitest";
import { runChecks, type Fetch } from "../scripts/live-check.mts";

const SITE = "https://site.test";
const ADMIN = "https://admin.test";
const CMS = "https://cms.test";
const SECURE = {
  "content-security-policy": "default-src 'self'",
  "strict-transport-security": "max-age=63072000",
  "x-frame-options": "DENY",
};

type Route = (init?: RequestInit) => Response;

const notFound: Route = () => new Response("Not found", { status: 404 });

const page: Route = () => new Response("<html></html>", { headers: SECURE });

const toLogin: Route = (init) =>
  new Headers(init?.headers).get("accept")?.includes("text/html")
    ? new Response(null, { status: 302, headers: { location: "/auth/login" } })
    : new Response(null, { status: 401 });

const toAccess: Route = () =>
  new Response(null, {
    status: 302,
    headers: { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login/admin.test" },
  });

function healthy(): Record<string, Route> {
  return {
    [`${SITE}/api/health`]: () => Response.json({ ok: true }),
    [`${SITE}/subscribe`]: () => new Response('<div data-sitekey="0x4AAAAreal"></div>'),
    [`${SITE}/`]: page,
    [`${SITE}/faq`]: page,
    [`${SITE}/people`]: page,
    [`${SITE}/blog`]: page,
    [`${SITE}/logo.svg`]: () => new Response("<svg/>"),
    [`${SITE}/favicon.svg`]: () => new Response("<svg/>"),
    [`${SITE}/_emdash/admin`]: toLogin,
    [`${SITE}/_emdash/admin/login`]: () =>
      new Response("<html></html>", { headers: { "x-robots-tag": "noindex, nofollow" } }),
    [`${SITE}/_emdash/api/health`]: notFound,
    [`${SITE}/_emdash/api/setup/status`]: notFound,
    [`${SITE}/_emdash/api/oauth/register`]: notFound,
    [`${SITE}/.well-known/oauth-protected-resource`]: notFound,
    [`${SITE}/_emdash/api/media/file/x.png`]: notFound,
    [`${SITE}/_image?href=/_emdash/api/media/file/x.png`]: notFound,
    [`${SITE}/media/x.png`]: notFound,
    [`${SITE}/wp-login.php`]: () => new Response("Forbidden", { status: 403 }),
    [`${SITE}/_emdash/api/mcp`]: () =>
      Response.json(
        { error: { code: "INVALID_TOKEN" } },
        {
          status: 401,
          headers: { "www-authenticate": 'Bearer resource_metadata="https://site.test/x"' },
        },
      ),
    [`${ADMIN}/`]: toAccess,
    [`${ADMIN}/api/summary`]: toAccess,
    [`${CMS}/`]: () => new Response(null, { status: 301, headers: { location: `${SITE}/admin` } }),
  };
}

function serve(routes: Record<string, Route>): Fetch {
  return async (url, init) => {
    const route = routes[url];
    if (route === undefined) throw new TypeError(`fetch failed: ${url}`);
    return route(init);
  };
}

async function failed(routes: Record<string, Route>): Promise<string[]> {
  const checks = await runChecks(SITE, ADMIN, CMS, serve(routes));
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

  it("fails when the signup form carries no sitekey", async () => {
    const routes = { ...healthy(), [`${SITE}/subscribe`]: () => new Response("<form></form>") };
    expect(await failed(routes)).toEqual(["site sitekey"]);
  });

  it("fails when the home page lacks a security header", async () => {
    const framed: Route = () =>
      new Response("<html></html>", { headers: { ...SECURE, "x-frame-options": "SAMEORIGIN" } });
    expect(await failed({ ...healthy(), [`${SITE}/`]: framed })).toEqual(["site security headers"]);
    const bare: Route = () => new Response("<html></html>");
    expect(await failed({ ...healthy(), [`${SITE}/`]: bare })).toEqual(["site security headers"]);
  });

  it("fails when a content page does not render", async () => {
    const broken: Route = () => new Response("Internal error", { status: 500 });
    expect(await failed({ ...healthy(), [`${SITE}/faq`]: broken })).toEqual([
      "site renders the content",
    ]);
  });

  it("fails when a brand file is missing", async () => {
    const routes = {
      ...healthy(),
      [`${SITE}/favicon.svg`]: () => new Response(null, { status: 404 }),
    };
    expect(await failed(routes)).toEqual(["site brand files"]);
  });

  it("fails when the content manager opens to a stranger or signs in on another host", async () => {
    const elsewhere: Route = () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/auth/login" },
      });
    expect(await failed({ ...healthy(), [`${SITE}/_emdash/admin`]: page })).toEqual([
      "content manager asks for a sign-in",
    ]);
    expect(await failed({ ...healthy(), [`${SITE}/_emdash/admin`]: elsewhere })).toEqual([
      "content manager asks for a sign-in",
    ]);
  });

  it("fails when the content manager is open to search engines", async () => {
    const routes = { ...healthy(), [`${SITE}/_emdash/admin/login`]: page };
    expect(await failed(routes)).toEqual(["content manager stays out of search"]);
  });

  it("fails when an unused route answers", async () => {
    const routes = { ...healthy(), [`${SITE}/_emdash/api/health`]: () => Response.json({}) };
    expect(await failed(routes)).toEqual(["site denies the unused routes"]);
  });

  it("fails when a stored file opens to a stranger", async () => {
    const image: Route = () => new Response("png", { headers: { "content-type": "image/png" } });
    const routes = { ...healthy(), [`${SITE}/media/x.png`]: image };
    expect(await failed(routes)).toEqual(["site refuses the unpublished files"]);
  });

  it("fails when EmDash answers for a stored file in place of the gate", async () => {
    const missing: Route = () => Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    const routes = { ...healthy(), [`${SITE}/_image?href=/_emdash/api/media/file/x.png`]: missing };
    expect(await failed(routes)).toEqual(["site refuses the unpublished files"]);
  });

  it("fails when a scanner path reaches the Worker", async () => {
    const routes = { ...healthy(), [`${SITE}/wp-login.php`]: notFound };
    expect(await failed(routes)).toEqual(["site blocks the scanners"]);
  });

  it("fails when the MCP address answers an unknown token", async () => {
    const open: Route = () => Response.json({ result: { tools: [] } });
    expect(await failed({ ...healthy(), [`${SITE}/_emdash/api/mcp`]: open })).toEqual([
      "content manager refuses an unknown MCP token",
    ]);
  });

  it("fails when the site refuses the call before EmDash, or nothing answers", async () => {
    const refused: Route = () =>
      Response.json({ error: { code: "NOT_SIGNED_IN" } }, { status: 401 });
    const missing: Route = () => new Response("Not found", { status: 404 });
    for (const route of [refused, missing]) {
      expect(await failed({ ...healthy(), [`${SITE}/_emdash/api/mcp`]: route })).toEqual([
        "content manager refuses an unknown MCP token",
      ]);
    }
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

  it("fails when the old cms host does not send a visitor to the site admin path", async () => {
    const stillServes: Route = () => new Response("<html></html>");
    expect(await failed({ ...healthy(), [`${CMS}/`]: stillServes })).toEqual([
      "cms points at the site",
    ]);
  });
});
