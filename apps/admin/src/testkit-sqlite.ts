import { DatabaseSync } from "node:sqlite";
import {
  REASON_FIELDS,
  type ReasonField,
  ROLE_FIELDS,
  type RoleField,
  type WaitlistRow,
} from "@rupeefund/db/schema";
import { migratedD1 } from "@rupeefund/db/testing";
import type { AdminEnv } from "./types.ts";

type Bindable = null | number | bigint | string | Uint8Array;

export interface SqliteFixture {
  db: AdminEnv["DB"];
  raw: DatabaseSync;
  seed(rows: SeedRow[]): void;
  plan(sql: string, bindings?: Bindable[]): string[];
  close(): void;
}

export type SeedRow = Pick<WaitlistRow, "email"> &
  Partial<
    Pick<
      WaitlistRow,
      | "name"
      | "source"
      | "amount"
      | "months"
      | "question"
      | "updates_opt_in"
      | RoleField
      | ReasonField
      | "exported_at"
      | "unsubscribed_at"
      | "created_at"
    >
  >;

const SEED_COLUMNS = [
  "email",
  "name",
  "consent_at",
  "source",
  "amount",
  "months",
  "question",
  "updates_opt_in",
  ...ROLE_FIELDS,
  ...REASON_FIELDS,
  "exported_at",
  "unsubscribed_at",
  "created_at",
  "updated_at",
] as const;

const SEED_SQL = `INSERT INTO waitlist (${SEED_COLUMNS.join(", ")})
   VALUES (${SEED_COLUMNS.map(() => "?").join(", ")})`;

export function makeSqlite(): SqliteFixture {
  const { db, raw } = migratedD1();

  return {
    db,
    raw,
    seed(rows) {
      const insert = raw.prepare(SEED_SQL);
      for (const [index, row] of rows.entries()) {
        const at = row.created_at ?? 1_700_000_000_000 + index * 86_400_000;
        insert.run(
          row.email,
          row.name ?? "A Person",
          at,
          row.source ?? "subscribe",
          row.amount === undefined ? 500 : row.amount,
          row.months === undefined ? "12" : row.months,
          row.question === undefined ? "" : row.question,
          row.updates_opt_in === undefined ? 1 : row.updates_opt_in,
          ...[...ROLE_FIELDS, ...REASON_FIELDS].map((field) => row[field] ?? null),
          row.exported_at ?? null,
          row.unsubscribed_at ?? null,
          at,
          at,
        );
      }
    },
    plan(sql, bindings = []) {
      return raw
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...bindings)
        .map((row) => (row as { detail: string }).detail);
    },
    close() {
      raw.close();
    },
  };
}
