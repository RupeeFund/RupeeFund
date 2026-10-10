import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const DONE = "No migrations to apply";
const WIN = process.platform === "win32";
const wrangler = resolve("node_modules", ".bin", WIN ? "wrangler.cmd" : "wrangler");

it("wrangler still reports a migrated database in the words that db:migrate checks", () => {
  expect(readFileSync("scripts/db-migrate.mjs", "utf8")).toContain(DONE);
  const dir = mkdtempSync(join(tmpdir(), "rf-migrate-"));
  const run = (verb: string) =>
    spawnSync(
      WIN ? `"${wrangler}"` : wrangler,
      ["d1", "migrations", verb, "rupeefund-waitlist", "--local", "--persist-to", dir],
      { encoding: "utf8", shell: WIN, stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
    );
  try {
    expect(run("apply").status).toBe(0);
    expect(run("list").stdout).toContain(DONE);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);
