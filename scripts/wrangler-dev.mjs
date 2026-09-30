import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

// workaround: nodejs/node#21825 — a .cmd needs a shell, which searches CWD first
const WIN = process.platform === "win32";
const wrangler = resolve("node_modules", ".bin", WIN ? "wrangler.cmd" : "wrangler");
const { PORT, PORTLESS_URL } = process.env;
const portless = PORTLESS_URL !== undefined;

const args = [
  "dev",
  ...process.argv.slice(2),
  ...(portless ? ["--port", PORT] : []),
  "--persist-to",
  "../../.wrangler/state",
  ...(portless ? ["--show-interactive-dev-session=false"] : []),
];

const child = spawn(WIN ? `"${wrangler}"` : wrangler, args, {
  stdio: ["inherit", portless ? "pipe" : "inherit", "inherit"],
  env: process.env,
  shell: WIN,
});

if (portless) {
  const local = /http:\/\/(localhost|127\.0\.0\.1):\d+/g;
  createInterface({ input: child.stdout }).on("line", (line) => {
    process.stdout.write(`${line.replace(local, PORTLESS_URL)}\n`);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
