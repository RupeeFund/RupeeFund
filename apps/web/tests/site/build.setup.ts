import { execSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { MEDIA_ROUTES, MISSING, RENDERED, ROUTES, fileFor } from "./routes.ts";

const TEST_SITEKEY = "1x00000000000000000000AA";
const STATE = "../../.wrangler/site-test";

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

async function render(base: string): Promise<void> {
  rmSync(RENDERED, { recursive: true, force: true });
  const answers: Record<string, { status: number; type: string | null; csp: string | null }> = {};
  for (const route of [...ROUTES, ...MISSING, ...MEDIA_ROUTES]) {
    const res = await fetch(`${base}${route}`, { redirect: "manual" });
    answers[route] = {
      status: res.status,
      type: res.headers.get("content-type"),
      csp: res.headers.get("content-security-policy"),
    };
    const body = Buffer.from(await res.arrayBuffer());
    if (!ROUTES.includes(route)) continue;
    const file = join(RENDERED, fileFor(route));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  writeFileSync(join(RENDERED, "answers.json"), JSON.stringify(answers, null, 2));
}

export default async function setup(): Promise<void> {
  exec("astro build --outDir dist-preview", {
    ...process.env,
    PUBLIC_TURNSTILE_SITEKEY: TEST_SITEKEY,
    PUBLIC_ALLOW_TEST_SITEKEY: "true",
  });
  exec(`node scripts/seed-local.mjs ${STATE}`);
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const wrangler = resolve("node_modules", ".bin", WIN ? "wrangler.cmd" : "wrangler");
  const args = ["dev", "--port", String(port), "--persist-to", STATE];
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
