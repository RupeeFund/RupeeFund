import { spawn, type ChildProcess } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  watch,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1));
}

function same(a: string, b: string): boolean {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

export function syncDir(from: string, to: string): string[] {
  const wanted = new Set(files(from));
  const changed: string[] = [];
  for (const path of files(to)) {
    if (wanted.has(path)) continue;
    rmSync(join(to, path));
    changed.push(path);
  }
  for (const entry of readdirSync(to, { recursive: true, withFileTypes: true }).reverse()) {
    const path = join(entry.parentPath, entry.name);
    if (entry.isDirectory() && readdirSync(path).length === 0) rmSync(path, { recursive: true });
  }
  for (const path of wanted) {
    if (same(join(from, path), join(to, path))) continue;
    mkdirSync(dirname(join(to, path)), { recursive: true });
    writeFileSync(join(to, path), readFileSync(join(from, path)));
    changed.push(path);
  }
  return changed;
}

const SERVED = "dist-dev";
export const STAGE = "dist-dev-stage";
const WATCHED = ["src", "public", "../../packages/ui/src"];
const CONFIG = "astro.config.mjs";
const SETTLE_MS = 100;

// workaround: nodejs/node#21825 — a .cmd needs a shell, which searches CWD first
const WIN = process.platform === "win32";
const astro = resolve("node_modules", ".bin", WIN ? "astro.cmd" : "astro");

async function main(): Promise<void> {
  let child: ChildProcess | undefined;
  let wrangler: ChildProcess | undefined;
  let pending: NodeJS.Timeout | undefined;
  let busy = false;
  let again = false;

  function schedule(): void {
    clearTimeout(pending);
    pending = setTimeout(rebuild, SETTLE_MS);
  }

  const watchers = [
    ...WATCHED.map((path) => watch(path, { recursive: true }, schedule)),
    watch(".", (_, name) => name === CONFIG && schedule()),
  ];

  function stop(code: number): never {
    clearTimeout(pending);
    child?.kill();
    for (const watcher of watchers) watcher.close();
    rmSync(STAGE, { recursive: true, force: true });
    process.exit(code);
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => (wrangler === undefined ? stop(1) : wrangler.kill(signal)));
  }

  function build(): Promise<string | null> {
    return new Promise((done) => {
      child = spawn(WIN ? `"${astro}"` : astro, ["build", "--outDir", STAGE], {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
        shell: WIN,
      });
      let log = "";
      child.stdout?.on("data", (chunk) => (log += chunk));
      child.stderr?.on("data", (chunk) => (log += chunk));
      child.on("exit", (code) => done(code === 0 ? null : log));
    });
  }

  async function rebuild(): Promise<void> {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    const started = Date.now();
    try {
      const failure = await build();
      if (failure !== null) throw new Error(failure);
      const changed = syncDir(STAGE, SERVED);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      process.stdout.write(`Site rebuilt in ${seconds} s. Files changed: ${changed.length}.\n`);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${text}\nThe build failed. The last good site stays up.\n`);
    } finally {
      busy = false;
    }
    if (again) {
      again = false;
      await rebuild();
    }
  }

  mkdirSync(SERVED, { recursive: true });
  await rebuild();

  wrangler = spawn(
    process.execPath,
    [
      "../../scripts/wrangler-dev.mjs",
      "--assets",
      SERVED,
      "--live-reload",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );

  wrangler.on("exit", (code, signal) => stop(code ?? (signal ? 1 : 0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  await main();
