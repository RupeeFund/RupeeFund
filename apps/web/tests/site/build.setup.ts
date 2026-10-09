import { execSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";
import { stringify } from "devalue";
import { cookieNames, seal } from "@rupeefund/auth";
import { CREATE_SESSIONS } from "../../src/auth/session-store.ts";
import {
  ALLOWED_WRITES,
  CONTENT_MANAGER,
  DENIED,
  GATED_MEDIA,
  ANONYMOUS_CALLS,
  MEDIA_ROUTES,
  MISSING,
  REFUSED_WRITES,
  RENDERED,
  RESIZED_MEDIA,
  ROUTES,
  SESSION,
  SESSION_SCHEMA_WRITE,
  SIGNED_IN_READS,
  SESSION_MCP,
  SIGNED_IN_SEARCH,
  TOKEN_MCP,
  TOKEN_ON_PUBLIC_ROUTE,
  TOKENS,
  TOKEN_SCHEMA_WRITE,
  VISITS,
  callName,
  fileFor,
  type Answer,
  type Call,
  type Seen,
  type Visit,
  FORGED_MCP,
  FORGED_TOKEN,
} from "./routes.ts";

const TEST_SITEKEY = "1x00000000000000000000AA";
const STATE = "../../.wrangler/site-test";
const D1_FILES = join(STATE, "v3", "d1", "miniflare-D1DatabaseObject");
const BROWSERS = [SESSION];
const AUTH_SECRET = randomBytes(32).toString("base64url");
const identities = new Map<string, string>();

// workaround: nodejs/node#21825 — a .cmd needs a shell, which searches CWD first
const WIN = process.platform === "win32";

function exec(command: string, env: NodeJS.ProcessEnv = process.env): void {
  try {
    execSync(command, { stdio: "pipe", env });
  } catch (error) {
    const shown = error as { stdout?: Buffer; stderr?: Buffer };
    process.stderr.write(String(shown.stdout ?? ""));
    process.stderr.write(String(shown.stderr ?? ""));
    throw error;
  }
}

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => done(port));
    });
  });
}

async function ready(base: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    const answer = await fetch(`${base}/api/health`).catch(() => null);
    if (answer?.ok) return;
    await sleep(500);
  }
  throw new Error(`The preview server at ${base} did not start`);
}

async function addCallers(): Promise<void> {
  for (const { user, role } of BROWSERS) {
    const member = { email: `${user}@example.com`, name: user, role };
    identities.set(user, await seal(member, AUTH_SECRET, 3600));
  }
  for (const file of readdirSync(D1_FILES).filter((name) => name.endsWith(".sqlite"))) {
    const db = new DatabaseSync(join(D1_FILES, file));
    const content = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ec_pages'")
      .get();
    if (content) {
      const addUser = db.prepare("INSERT INTO users (id, email, role) VALUES (?, ?, ?)");
      for (const { user, role } of BROWSERS) addUser.run(user, `${user}@example.com`, role);
      for (const { user, role, token, scopes } of Object.values(TOKENS)) {
        const hash = createHash("sha256").update(token).digest("base64url");
        addUser.run(user, `${user}@example.com`, role);
        db.prepare(
          `INSERT INTO _emdash_api_tokens (id, name, token_hash, prefix, user_id, scopes)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(user, user, hash, token.slice(0, 8), user, JSON.stringify(scopes));
      }
      db.exec(CREATE_SESSIONS);
      const addSession = db.prepare(
        "INSERT INTO rupeefund_sessions (key, value, updated_at) VALUES (?, ?, unixepoch())",
      );
      for (const { user, id } of BROWSERS) {
        addSession.run(id, stringify(new Map([["user", { data: { id: user } }]])));
      }
    }
    db.close();
  }
}

const signedIn = (base: string, { user, id }: (typeof BROWSERS)[number]): string[] => [
  `astro-session=${id}`,
  `${cookieNames(base).identity}=${identities.get(user)}`,
];

function headersFor(base: string, as: Call["as"]): Record<string, string> {
  const json = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "x-emdash-request": "1",
  };
  if (as === "anonymous") return json;
  if (as === "session") return { ...json, cookie: signedIn(base, SESSION).join("; ") };
  if (as === "forged") return { ...json, authorization: `Bearer ${FORGED_TOKEN}` };
  return { ...json, authorization: `Bearer ${TOKENS[as].token}` };
}

async function call(base: string, { as, method, path, body }: Call): Promise<Answer> {
  const res = await fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: headersFor(base, as),
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  return {
    status: res.status,
    type: res.headers.get("content-type"),
    csp: null,
    frame: null,
    robots: null,
    hsts: null,
    body: (await res.text()).slice(0, 200),
    cache: res.headers.get("cache-control"),
  };
}

async function visit(base: string, { path, editMode }: Visit): Promise<Seen> {
  const cookies = [...signedIn(base, SESSION), ...(editMode ? ["emdash-edit-mode=true"] : [])];
  const res = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: { cookie: cookies.join("; ") },
  });
  const html = await res.text();
  return {
    status: res.status,
    location: res.headers.get("location"),
    setCookie: res.headers.get("set-cookie"),
    pill: html.includes("<!-- EmDash Toolbar Bootstrap -->"),
    toolbar: html.includes('id="emdash-toolbar"'),
    marks: html.match(/data-emdash-ref=/g)?.length ?? 0,
  };
}

async function render(base: string): Promise<void> {
  rmSync(RENDERED, { recursive: true, force: true });
  const answers: Record<string, Answer> = {};
  const all = [
    ...ROUTES,
    ...MISSING,
    ...MEDIA_ROUTES,
    ...GATED_MEDIA,
    ...RESIZED_MEDIA,
    ...DENIED,
    ...CONTENT_MANAGER,
  ];
  for (const route of all) {
    const res = await fetch(`${base}${route}`, { redirect: "manual" });
    answers[route] = {
      status: res.status,
      type: res.headers.get("content-type"),
      csp: res.headers.get("content-security-policy"),
      frame: res.headers.get("x-frame-options"),
      robots: res.headers.get("x-robots-tag"),
      hsts: res.headers.get("strict-transport-security"),
      body: null,
      cache: res.headers.get("cache-control"),
    };
    const body = Buffer.from(await res.arrayBuffer());
    if (res.status >= 400) answers[route].body = body.toString("utf8").slice(0, 200);
    if (!ROUTES.includes(route)) continue;
    const file = join(RENDERED, fileFor(route));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  const calls = [
    ...REFUSED_WRITES,
    ...ALLOWED_WRITES,
    ...SIGNED_IN_READS,
    SESSION_SCHEMA_WRITE,
    TOKEN_SCHEMA_WRITE,
    SIGNED_IN_SEARCH,
    TOKEN_ON_PUBLIC_ROUTE,
    TOKEN_MCP,
    SESSION_MCP,
    FORGED_MCP,
    ...ANONYMOUS_CALLS,
  ];
  for (const one of calls) answers[callName(one)] = await call(base, one);
  writeFileSync(join(RENDERED, "answers.json"), JSON.stringify(answers, null, 2));
  const seen: Record<string, Seen> = {};
  for (const [name, one] of Object.entries(VISITS)) seen[name] = await visit(base, one);
  writeFileSync(join(RENDERED, "visits.json"), JSON.stringify(seen, null, 2));
}

const VITEST_ENV = new Set(["DEV", "PROD", "SSR", "MODE", "BASE_URL", "NODE_ENV", "TEST"]);

function outsideVitest(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !VITEST_ENV.has(name) && !name.startsWith("VITEST"),
    ),
  );
}

export default async function setup(): Promise<void> {
  exec("astro build --outDir dist-preview", {
    ...outsideVitest(),
    PUBLIC_TURNSTILE_SITEKEY: TEST_SITEKEY,
    PUBLIC_ALLOW_TEST_SITEKEY: "true",
  });
  exec(`node scripts/seed-local.mjs ${STATE}`);
  await addCallers();
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const wrangler = resolve("node_modules", ".bin", WIN ? "wrangler.cmd" : "wrangler");
  const args = [
    "dev",
    "--port",
    String(port),
    "--persist-to",
    STATE,
    "--var",
    `AUTH_SECRET:${AUTH_SECRET}`,
    "--var",
    `AUTH_ORIGIN:${base}`,
  ];
  const server = spawn(
    WIN ? `"${wrangler}"` : wrangler,
    [...args, "--show-interactive-dev-session=false"],
    {
      stdio: "ignore",
      shell: WIN,
    },
  );
  try {
    await ready(base);
    await render(base);
  } finally {
    server.kill("SIGTERM");
  }
}
