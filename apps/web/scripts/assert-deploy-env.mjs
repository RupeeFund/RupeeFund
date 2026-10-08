import { readFileSync } from "node:fs";
import { DUMMY_SITEKEYS } from "./turnstile-dummy-keys.mjs";

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/,(\s*[}\]])/g, "$1"));

const SITEKEY_LENGTH = 24;
const SITEKEY_SHAPE = /^0x4[A-Za-z0-9_-]{21}$/;

const problems = [];
const lib = readFileSync(new URL("../src/lib/turnstile.ts", import.meta.url), "utf8");
const declared = /export const TURNSTILE_SITEKEY = "([^"]*)"/.exec(lib)?.[1];
const declaredAction = /export const TURNSTILE_ACTION = "([^"]*)"/.exec(lib)?.[1];

if (declared === undefined || declared.length === 0) {
  problems.push(
    "src/lib/turnstile.ts declares no TURNSTILE_SITEKEY. The sitekey is public and lives in the repository, so a build must find it there.",
  );
} else if (DUMMY_SITEKEYS.includes(declared)) {
  problems.push(
    `src/lib/turnstile.ts declares Cloudflare's dummy TEST sitekey ${declared}. Use the real one from the Turnstile dashboard.`,
  );
} else if (!SITEKEY_SHAPE.test(declared)) {
  // A Turnstile secret shares the sitekey prefix and is longer. Pinning the
  // length stops a rotation pasting the secret into a public, committed file.
  problems.push(
    `src/lib/turnstile.ts declares ${declared.length} characters. A Turnstile sitekey is ${SITEKEY_LENGTH}. A longer value is the secret, and committing that publishes it.`,
  );
}

const override = process.env.PUBLIC_TURNSTILE_SITEKEY;
if (
  override !== undefined &&
  DUMMY_SITEKEYS.includes(override) &&
  process.env.PUBLIC_ALLOW_TEST_SITEKEY !== "true"
) {
  problems.push(
    `PUBLIC_TURNSTILE_SITEKEY overrides the repository with the dummy TEST sitekey ${override}. Set PUBLIC_ALLOW_TEST_SITEKEY=true for a local preview, or drop the override.`,
  );
}

if (config.env !== undefined) {
  problems.push(
    "wrangler.jsonc declares an env block. This project ships one environment, so a second target can only drift from it.",
  );
}

if (config.workers_dev !== false || config.preview_urls !== false) {
  problems.push(
    'wrangler.jsonc must set "workers_dev": false and "preview_urls": false. Either one left open publishes the site on a workers.dev host that shares the production database.',
  );
}

const vars = config.vars ?? {};
const hostnames = String(vars.TURNSTILE_HOSTNAMES ?? "");

if (hostnames.length === 0) {
  problems.push(
    "TURNSTILE_HOSTNAMES is not set in wrangler.jsonc. An empty value turns the hostname check off, so a token solved on any other site would be accepted.",
  );
} else if (/localhost|127\.0\.0\.1|example\.com/.test(hostnames)) {
  problems.push(`TURNSTILE_HOSTNAMES contains a development host: ${hostnames}`);
}

if (String(vars.TURNSTILE_ACTION ?? "").length === 0) {
  problems.push(
    "TURNSTILE_ACTION is not set in wrangler.jsonc. An empty value turns the action check off.",
  );
} else if (vars.TURNSTILE_ACTION !== declaredAction) {
  // The widget mints a token for the action in src/lib/turnstile.ts; the Worker
  // demands the action in wrangler.jsonc. If they differ, every signup that runs
  // JavaScript gets a 403 and the build stays green.
  problems.push(
    `TURNSTILE_ACTION is "${declaredAction}" in src/lib/turnstile.ts and "${vars.TURNSTILE_ACTION}" in wrangler.jsonc. The widget and the Worker must name one action.`,
  );
}

if (problems.length > 0) {
  console.error(`refusing to build:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
