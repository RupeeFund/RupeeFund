import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.PORT ?? "8787";
const LIMIT_MS = Number(process.env.LIMIT_MS ?? 60_000);
const URLS = [`http://127.0.0.1:${PORT}/`, `http://[::1]:${PORT}/`];
const start = Date.now();

const child = spawn("pnpm", ["dev", "--port", PORT, "--ignore-lock"], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (chunk) => (log += chunk));
child.stderr.on("data", (chunk) => (log += chunk));
const exited = () => child.exitCode !== null || child.signalCode !== null;

function finish(code, message) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  if (code !== 0) process.stderr.write(log);
  console.log(message);
  process.exit(code);
}

async function status(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(10_000) })).status;
  } catch {
    return 0;
  }
}

while (!exited() && Date.now() - start < LIMIT_MS) {
  for (const url of URLS) {
    if ((await status(url)) === 200)
      finish(0, `dev-smoke: 200 on ${url} after ${Date.now() - start} ms`);
  }
  await sleep(500);
}
finish(1, `dev-smoke: no 200 on port ${PORT} after ${Date.now() - start} ms (exited: ${exited()})`);
