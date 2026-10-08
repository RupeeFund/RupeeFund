import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { contentDocument } from "../src/content/schema.ts";
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

async function signInRedirect(fetch: Fetch, cms: string): Promise<string | null> {
  const res = await fetch(`${cms}/_emdash/admin`, MANUAL);
  const location = res.headers.get("location") ?? "";
  const target = URL.canParse(location, cms) ? new URL(location, cms) : null;
  const toLogin =
    target?.origin === new URL(cms).origin && target.pathname === "/_emdash/admin/login";
  if (res.status === 302 && toLogin) return null;
  return `answered ${res.status} ${location}`.trim() + ", not a redirect to the cms sign-in";
}

async function notFound(fetch: Fetch, url: string): Promise<string | null> {
  const { status } = await fetch(url, MANUAL);
  return status === 404 ? null : `answered ${status}, not 404`;
}

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
        const missing = ["content-security-policy", "strict-transport-security"].filter(
          (name) => !headers.has(name),
        );
        return missing.length === 0 ? null : `missing ${missing.join(", ")}`;
      },
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
    ["admin refuses the page", (fetch) => accessRedirect(fetch, `${admin}/`)],
    ["admin refuses the counts", (fetch) => accessRedirect(fetch, `${admin}/api/summary`)],
    [
      "cms content",
      async (fetch) => {
        const res = await fetch(`${cms}/published.json`);
        if (res.status !== 200) return `answered ${res.status}`;
        const parsed = contentDocument.safeParse(await res.json().catch(() => null));
        return parsed.success ? null : `breaks the schema: ${parsed.error.message}`;
      },
    ],
    [
      "cms setup is done",
      async (fetch) => {
        const res = await fetch(`${cms}/_emdash/api/setup/status`);
        const body = (await res.json().catch(() => null)) as {
          data?: { needsSetup?: unknown };
        } | null;
        if (res.status === 200 && body?.data?.needsSetup === false) return null;
        return `answered ${res.status}, the cms has no admin yet`;
      },
    ],
    ["cms refuses the admin", (fetch) => signInRedirect(fetch, cms)],
    ["cms refuses the preview", (fetch) => notFound(fetch, `${cms}/preview/posts/x`)],
    [
      "cms blocks the scanners",
      async (fetch) => {
        const { status } = await fetch(`${cms}/wp-login.php`, MANUAL);
        return status === 403 ? null : `answered ${status}, not 403 from the WAF rule`;
      },
    ],
    [
      "cms refuses the stored files",
      async (fetch) => {
        const problems: string[] = [];
        for (const path of [
          "/_emdash/api/media/file/x.png",
          "/_image?href=/_emdash/api/media/file/x.png",
        ]) {
          const res = await fetch(`${cms}${path}`, MANUAL);
          const gated = res.status === 404 && (await res.text()) === "Not found";
          if (!gated) problems.push(`${path} answered ${res.status} without the sign-in gate`);
        }
        return problems.length === 0 ? null : problems.join(", ");
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
