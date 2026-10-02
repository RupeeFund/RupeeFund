import { spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  watch,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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
  for (const path of wanted) {
    if (same(join(from, path), join(to, path))) continue;
    mkdirSync(dirname(join(to, path)), { recursive: true });
    writeFileSync(join(to, path), readFileSync(join(from, path)));
    changed.push(path);
  }
  for (const entry of readdirSync(to, { recursive: true, withFileTypes: true }).reverse()) {
    const path = join(entry.parentPath, entry.name);
    if (entry.isDirectory() && readdirSync(path).length === 0) rmSync(path, { recursive: true });
  }
  return changed;
}

const SERVED = "dist-dev";
const WATCHED = ["src", "public", "../../packages/ui/src", "astro.config.mjs"];
const SETTLE_MS = 100;

// workaround: nodejs/node#21825 — a .cmd needs a shell, which searches CWD first
const WIN = process.platform === "win32";
const astro = resolve("node_modules", ".bin", WIN ? "astro.cmd" : "astro");

function build(outDir: string): Promise<string | null> {
  return new Promise((done) => {
    const child = spawn(WIN ? `"${astro}"` : astro, ["build", "--outDir", outDir], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: WIN,
    });
    let log = "";
    child.stdout.on("data", (chunk) => (log += chunk));
    child.stderr.on("data", (chunk) => (log += chunk));
    child.on("exit", (code) => done(code === 0 ? null : log));
  });
}

async function main(): Promise<void> {
  const stage = mkdtempSync(join(tmpdir(), "rupeefund-dev-"));
  let busy = false;
  let again = false;

  async function rebuild(): Promise<boolean> {
    if (busy) {
      again = true;
      return true;
    }
    busy = true;
    const started = Date.now();
    const failure = await build(stage);
    if (failure === null) {
      const changed = syncDir(stage, SERVED);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      process.stdout.write(`Site rebuilt in ${seconds} s. Files changed: ${changed.length}.\n`);
    } else {
      process.stderr.write(`${failure}\nThe build failed. The last good site stays up.\n`);
    }
    busy = false;
    if (again) {
      again = false;
      void rebuild();
    }
    return failure === null;
  }

  mkdirSync(SERVED, { recursive: true });
  if (!(await rebuild())) process.exit(1);

  let pending: NodeJS.Timeout | undefined;
  const watchers = WATCHED.map((path) =>
    watch(path, { recursive: true }, () => {
      clearTimeout(pending);
      pending = setTimeout(rebuild, SETTLE_MS);
    }),
  );

  const wrangler = spawn(
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

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => wrangler.kill(signal));
  }

  wrangler.on("exit", (code, signal) => {
    for (const watcher of watchers) watcher.close();
    rmSync(stage, { recursive: true, force: true });
    process.exit(code ?? (signal ? 1 : 0));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  await main();
