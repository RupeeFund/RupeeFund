import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// workaround: CVE-2024-27980 — Node spawns a .cmd only through a shell, which searches CWD first
const WIN = process.platform === "win32";
const localBin = (name) => resolve("node_modules", ".bin", WIN ? `${name}.cmd` : name);

const steps = [
  [process.execPath, ["scripts/assert-deploy-env.mjs"], false],
  [process.execPath, ["../../packages/db/scripts/assert-applied.mts"], false],
  [localBin("astro"), ["build"], WIN],
  [process.execPath, ["scripts/assert-dist-sitekey.mjs"], false],
];

for (const [command, args, shell] of steps) {
  const { status } = spawnSync(shell ? `"${command}"` : command, args, {
    stdio: "inherit",
    env: process.env,
    shell,
  });
  if (status !== 0) process.exit(status ?? 1);
}
