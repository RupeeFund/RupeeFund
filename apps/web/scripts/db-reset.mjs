import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const STATE = "../../.wrangler/state";

rmSync(`${STATE}/v3/d1`, { recursive: true, force: true });

// workaround: nodejs/node#21825 — a .cmd needs a shell, which searches CWD first
const WIN = process.platform === "win32";
const wrangler = resolve("node_modules", ".bin", WIN ? "wrangler.cmd" : "wrangler");

const { status } = spawnSync(
  WIN ? `"${wrangler}"` : wrangler,
  ["d1", "migrations", "apply", "rupeefund-waitlist", "--local", "--persist-to", STATE],
  { stdio: "inherit", env: process.env, shell: WIN },
);
process.exit(status ?? 1);
