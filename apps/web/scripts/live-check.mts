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

function probes(site: string, admin: string): [string, Probe][] {
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
  ];
}

export async function runChecks(site: string, admin: string, fetch: Fetch): Promise<Check[]> {
  const checks: Check[] = [];
  for (const [name, probe] of probes(site, admin)) {
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
  const checks = await runChecks(site, admin, (url, init) => fetch(url, init));
  for (const { name, ok, detail } of checks) {
    process.stdout.write(ok ? `PASS ${name}\n` : `FAIL ${name}: ${detail}\n`);
  }
  if (checks.some((check) => !check.ok)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  await main();
