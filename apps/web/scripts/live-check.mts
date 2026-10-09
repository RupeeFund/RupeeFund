import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DUMMY_SITEKEYS } from "./turnstile-dummy-keys.mjs";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

type Probe = (fetch: Fetch) => Promise<string | null>;

const MANUAL: RequestInit = { redirect: "manual" };

async function accessRedirect(fetch: Fetch, url: string): Promise<string | null> {
  const res = await fetch(url, MANUAL);
  const location = res.headers.get("location") ?? "";
  const host = URL.canParse(location) ? new URL(location).hostname : "";
  if (res.status === 302 && host.endsWith(".cloudflareaccess.com")) return null;
  return `answered ${res.status} ${location}`.trim() + ", not a redirect to Cloudflare Access";
}

async function signInRedirect(fetch: Fetch, site: string): Promise<string | null> {
  const res = await fetch(`${site}/_emdash/admin`, { ...MANUAL, headers: { accept: "text/html" } });
  const location = res.headers.get("location") ?? "";
  const target = URL.canParse(location, site) ? new URL(location, site) : null;
  const toLogin = target?.origin === new URL(site).origin && target.pathname === "/auth/login";
  if (res.status === 302 && toLogin) return null;
  return `answered ${res.status} ${location}`.trim() + ", not a redirect to the sign-in";
}

async function eachAnswers(
  fetch: Fetch,
  urls: readonly string[],
  passes: (res: Response) => Promise<boolean>,
): Promise<string | null> {
  const problems: string[] = [];
  for (const url of urls) {
    const res = await fetch(url, MANUAL);
    if (!(await passes(res))) problems.push(`${new URL(url).pathname} answered ${res.status}`);
  }
  return problems.length === 0 ? null : problems.join(", ");
}

const SECURITY_HEADERS: Readonly<Record<string, string | null>> = {
  "content-security-policy": null,
  "strict-transport-security": null,
  "x-frame-options": "DENY",
};

function probes(site: string, admin: string, cms: string): [string, Probe][] {
  return [
    [
      "site health",
      async (fetch) => {
        const res = await fetch(`${site}/api/health`);
        const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
        return res.status === 200 && body?.ok === true ? null : `answered ${res.status}`;
      },
    ],
    [
      "site sitekey",
      async (fetch) => {
        const html = await (await fetch(`${site}/subscribe`)).text();
        const key = /data-sitekey="([^"]*)"/.exec(html)?.[1];
        if (!key) return "no sitekey on /subscribe";
        return DUMMY_SITEKEYS.includes(key) ? `test sitekey ${key}` : null;
      },
    ],
    [
      "site security headers",
      async (fetch) => {
        const { headers } = await fetch(`${site}/`);
        const wrong = Object.entries(SECURITY_HEADERS)
          .filter(
            ([name, value]) =>
              !headers.has(name) || (value !== null && headers.get(name) !== value),
          )
          .map(([name]) => name);
        return wrong.length === 0 ? null : `missing or wrong ${wrong.join(", ")}`;
      },
    ],
    [
      "site renders the content",
      (fetch) =>
        eachAnswers(
          fetch,
          ["/", "/faq", "/people", "/blog"].map((path) => `${site}${path}`),
          async (res) => res.status === 200,
        ),
    ],
    [
      "site brand files",
      async (fetch) => {
        const bad: string[] = [];
        for (const path of ["/logo.svg", "/favicon.svg"]) {
          const { status } = await fetch(`${site}${path}`);
          if (status !== 200) bad.push(`${path} ${status}`);
        }
        return bad.length === 0 ? null : bad.join(", ");
      },
    ],
    ["content manager asks for a sign-in", (fetch) => signInRedirect(fetch, site)],
    [
      "content manager stays out of search",
      async (fetch) => {
        const { headers } = await fetch(`${site}/_emdash/admin/login`, MANUAL);
        return headers.get("x-robots-tag")?.includes("noindex") ? null : "no noindex header";
      },
    ],
    [
      "site denies the unused routes",
      (fetch) =>
        eachAnswers(
          fetch,
          [
            "/_emdash/api/health",
            "/_emdash/api/setup/status",
            "/_emdash/api/oauth/register",
            "/.well-known/oauth-protected-resource",
          ].map((path) => `${site}${path}`),
          async (res) => res.status === 404,
        ),
    ],
    [
      "site refuses the unpublished files",
      (fetch) =>
        eachAnswers(
          fetch,
          [
            "/_emdash/api/media/file/x.png",
            "/_image?href=/_emdash/api/media/file/x.png",
            "/media/x.png",
          ].map((path) => `${site}${path}`),
          async (res) => res.status === 404 && (await res.text()) === "Not found",
        ),
    ],
    [
      "site blocks the scanners",
      async (fetch) => {
        const { status } = await fetch(`${site}/wp-login.php`, MANUAL);
        return status === 403 ? null : `answered ${status}, not 403 from the WAF rule`;
      },
    ],
    ["admin refuses the page", (fetch) => accessRedirect(fetch, `${admin}/`)],
    ["admin refuses the counts", (fetch) => accessRedirect(fetch, `${admin}/api/summary`)],
    [
      "cms points at the site",
      async (fetch) => {
        const res = await fetch(`${cms}/`, MANUAL);
        const location = res.headers.get("location") ?? "";
        if (res.status === 301 && location === `${site}/admin`) return null;
        return `answered ${res.status} ${location}`.trim() + `, not a 301 to ${site}/admin`;
      },
    ],
  ];
}

export async function runChecks(
  site: string,
  admin: string,
  cms: string,
  fetch: Fetch,
): Promise<Check[]> {
  const checks: Check[] = [];
  for (const [name, probe] of probes(site, admin, cms)) {
    try {
      const problem = await probe(fetch);
      checks.push({ name, ok: problem === null, detail: problem ?? "" });
    } catch (err) {
      checks.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return checks;
}

function option(argv: readonly string[], flag: string, fallback: string): string {
  const at = argv.indexOf(flag);
  return at === -1 ? fallback : (argv[at + 1] ?? fallback);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const site = option(argv, "--site", "https://rupeefund.org");
  const admin = option(argv, "--admin", "https://admin.rupeefund.org");
  const cms = option(argv, "--cms", "https://cms.rupeefund.org");
  const checks = await runChecks(site, admin, cms, (url, init) => fetch(url, init));
  for (const { name, ok, detail } of checks) {
    process.stdout.write(ok ? `PASS ${name}\n` : `FAIL ${name}: ${detail}\n`);
  }
  if (checks.some((check) => !check.ok)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  await main();
