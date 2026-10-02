import type { WaitlistRow } from "./schema.ts";

export const BATCH = 500;

const PENDING = "exported_at IS NULL AND unsubscribed_at IS NULL";
const EXPORT_COLUMNS = [
  "id",
  "email",
  "name",
  "source",
  "consent_at",
  "created_at",
  "updates_opt_in",
] as const satisfies readonly (keyof WaitlistRow)[];
const COLUMNS = EXPORT_COLUMNS.join(", ");

export const SELECT_PENDING = `SELECT ${COLUMNS} FROM waitlist
     WHERE ${PENDING} ORDER BY id LIMIT ${BATCH}`;

export const COUNT_PENDING = `SELECT COUNT(*) AS n FROM waitlist WHERE ${PENDING}`;

export function claimPending(at: number): string {
  if (!Number.isSafeInteger(at) || at <= 0) throw new RangeError(`bad export time: ${at}`);
  return `UPDATE waitlist SET exported_at = ${at}
     WHERE id IN (SELECT id FROM waitlist WHERE ${PENDING} ORDER BY id LIMIT ${BATCH})
     RETURNING ${COLUMNS}`;
}

export type ExportableRow = Pick<WaitlistRow, (typeof EXPORT_COLUMNS)[number]>;

export function toCsvField(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: readonly ExportableRow[]): string {
  const lines = ["email,name,attributes"];
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
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
