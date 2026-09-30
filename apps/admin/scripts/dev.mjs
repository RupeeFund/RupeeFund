import { spawn, spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const require = createRequire(import.meta.url);
const cliPackage = require.resolve("@tailwindcss/cli/package.json");
const TAILWIND = join(dirname(cliPackage), require(cliPackage).bin.tailwindcss);
const QUIET = /^(≈ tailwindcss|Done in|\s*$)/;
const SETTLE_MS = 50;

const tailwind = spawn(
  process.execPath,
  [TAILWIND, "-i", "src/admin.css", "-o", ".generated/admin.css", "--watch=always"],
  { stdio: ["ignore", "ignore", "pipe"] },
);

function stop(code) {
  tailwind.kill();
  process.exit(code);
}

let wrangler;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => (wrangler === undefined ? stop(1) : wrangler.kill(signal)));
}

const built = new Promise((resolve) => {
  createInterface({ input: tailwind.stderr }).on("line", (line) => {
    if (line.startsWith("Done in")) resolve();
    if (!QUIET.test(line)) process.stderr.write(`${line}\n`);
  });
});

function assets() {
  const run = spawnSync(process.execPath, ["scripts/assets.mjs"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return run.status;
}

const early = (code) => process.exit(code || 1);
tailwind.once("exit", early);
await built;
tailwind.off("exit", early);

if (assets() !== 0) stop(1);

let pending;
const watcher = watch(".generated", (_, name) => {
  if (name !== "admin.css") return;
  clearTimeout(pending);
  pending = setTimeout(assets, SETTLE_MS);
});

wrangler = spawn(
  process.execPath,
  ["../../scripts/wrangler-dev.mjs", "--local", ...process.argv.slice(2)],
  { stdio: "inherit" },
);

wrangler.on("exit", (code, signal) => {
  watcher.close();
  tailwind.kill();
  process.exit(code ?? (signal ? 1 : 0));
});
