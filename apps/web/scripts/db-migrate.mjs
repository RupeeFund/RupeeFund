import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DB = "rupeefund-waitlist";

// workaround: nodejs/node#21825 — a .cmd needs a shell, which searches CWD first
const WIN = process.platform === "win32";
const wrangler = resolve("node_modules", ".bin", WIN ? "wrangler.cmd" : "wrangler");

const remote = process.argv.includes("--remote");
const target = remote ? ["--remote"] : ["--local", "--persist-to", "../../.wrangler/state"];

function run(args, capture = false, onFail = () => {}) {
  const argv = WIN ? args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)) : args;
  const { status, stdout } = spawnSync(WIN ? `"${wrangler}"` : wrangler, argv, {
    stdio: [remote ? "inherit" : "ignore", capture ? "pipe" : "inherit", "inherit"],
    encoding: "utf8",
    env: process.env,
    shell: WIN,
  });
  if (status !== 0) {
    onFail();
    process.stderr.write(`wrangler ${args.slice(0, 3).join(" ")} failed. Nothing more ran.\n`);
    process.exit(status ?? 1);
  }
  return stdout ?? "";
}

if (remote) {
  const dir = mkdtempSync(join(tmpdir(), "rupeefund-"));
  const backup = join(dir, `${DB}-backup.sql`);
  run(["d1", "export", DB, "--remote", "--output", backup], false, () =>
    rmSync(dir, { recursive: true, force: true }),
  );
  process.stdout.write(`Backup: ${backup}\nIt holds the list. Delete it when you are done.\n`);
}

run(["d1", "migrations", "apply", DB, ...target]);

const left = run(["d1", "migrations", "list", DB, ...target], true);
if (!left.includes("No migrations to apply")) {
  process.stdout.write(left);
  process.stderr.write("Some migrations are still not applied.\n");
  process.exit(1);
}
process.stdout.write("Every migration is applied.\n");
