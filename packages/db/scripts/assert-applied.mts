import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { appliedNames, unapplied } from "../src/applied.ts";

const DB_NAME = "rupeefund-waitlist";
const MIGRATIONS = new URL("../migrations/", import.meta.url);

if (!process.env.WORKERS_CI) {
  process.stdout.write("Not a Workers Builds build. The migration guard does not run.\n");
  process.exit(0);
}

const stdout = execFileSync(
  resolve("node_modules", ".bin", "wrangler"),
  ["d1", "execute", DB_NAME, "--remote", "--json", "--command", "SELECT name FROM d1_migrations"],
  { encoding: "utf8" },
);
const missing = unapplied(readdirSync(MIGRATIONS), appliedNames(stdout));
if (missing.length > 0) {
  process.stderr.write(
    `refusing to build: the live database has not applied ${missing.join(", ")}.\n` +
      "Apply it first (docs/DEPLOY.md section 4).\n",
  );
  process.exit(1);
}
process.stdout.write("The live database has applied every migration.\n");
