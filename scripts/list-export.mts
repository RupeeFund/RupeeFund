import { execFileSync } from "node:child_process";

const DB_NAME = "rupeefund-waitlist";
const BATCH = 500;

export const SELECT_PENDING = `SELECT id, email, name, source, consent_at,
     created_at, updates_opt_in FROM waitlist
     WHERE exported_at IS NULL AND unsubscribed_at IS NULL ORDER BY id LIMIT ${BATCH}`;

export type Row = Record<string, unknown>;

export interface ExportableRow extends Row {
  email: string;
  name: string;
  source: string;
  consent_at: number;
  created_at: number;
  updates_opt_in: number;
}

export function toCsvField(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: readonly ExportableRow[]): string {
  const lines = ["email,name,attributes"];
  for (const row of rows) {
    const attributes = JSON.stringify({
      source: row.source,
      consent_at: row.consent_at,
      signed_up_at: row.created_at,
      updates_opt_in: row.updates_opt_in === 1,
    });
    lines.push([row.email, row.name, attributes].map(toCsvField).join(","));
  }
  return `${lines.join("\n")}\n`;
}

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
    remote ? "--remote" : "--local",
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
  const dryRun = argv.includes("--dry-run");

  const rows = query<ExportableRow>(SELECT_PENDING, remote);

  process.stdout.write(toCsv(rows));

  if (rows.length === 0) {
    process.stderr.write("nothing pending export\n");
    return;
  }
  if (dryRun) {
    process.stderr.write(`${rows.length} row(s) would be stamped; --dry-run made no changes\n`);
    return;
  }

  const ids = rows.map((r) => Number(r.id)).filter(Number.isInteger);
  query(
    `UPDATE waitlist SET exported_at = ${Date.now()} WHERE exported_at IS NULL AND id IN (${ids.join(",")})`,
    remote,
  );
  const stillPending = query(
    "SELECT COUNT(*) AS n FROM waitlist WHERE exported_at IS NULL AND unsubscribed_at IS NULL",
    remote,
  );
  const remaining = Number(stillPending[0]?.n ?? 0);
  process.stderr.write(`${ids.length} row(s) exported and stamped\n`);
  if (remaining > 0) {
    process.stderr.write(`${remaining} row(s) still pending — run again (batch size ${BATCH})\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
