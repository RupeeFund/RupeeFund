import { execFileSync } from "node:child_process";
import {
  BATCH,
  claimPending,
  COUNT_PENDING,
  type ExportableRow,
  SELECT_PENDING,
  toCsv,
} from "@rupeefund/db/export";

const DB_NAME = "rupeefund-waitlist";

export type Row = Record<string, unknown>;

export function parseD1Json(stdout: string): Row[] {
  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
}

function query<T extends Row = Row>(sql: string, remote: boolean): T[] {
  const args = [
    "wrangler",
    "d1",
    "execute",
    DB_NAME,
    ...(remote ? ["--remote"] : ["--local", "--persist-to", "../../.wrangler/state"]),
    "--json",
    "--command",
    sql,
  ];
  return parseD1Json(
    execFileSync("pnpm", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }),
  ) as T[];
}

function main() {
  const argv = process.argv.slice(2);
  const remote = argv.includes("--remote");

  if (argv.includes("--dry-run")) {
    const rows = query<ExportableRow>(SELECT_PENDING, remote);
    process.stdout.write(toCsv(rows));
    process.stderr.write(`${rows.length} row(s) would be stamped; --dry-run made no changes\n`);
    return;
  }

  const at = Date.now();
  const rows = query<ExportableRow>(claimPending(at), remote);
  process.stdout.write(toCsv(rows));
  if (rows.length === 0) {
    process.stderr.write("nothing pending export\n");
    return;
  }
  const remaining = Number(query(COUNT_PENDING, remote)[0]?.n ?? 0);
  process.stderr.write(`${rows.length} row(s) exported and stamped at ${at}\n`);
  if (remaining > 0) {
    process.stderr.write(`${remaining} row(s) still pending — run again (batch size ${BATCH})\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
