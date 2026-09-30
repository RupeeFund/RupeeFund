import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS_DIR, migrationFiles } from "@rupeefund/db/testing";
import type { AdminEnv } from "./types.ts";

type Bindable = null | number | bigint | string | Uint8Array;

export interface SqliteFixture {
  db: AdminEnv["DB"];
  raw: DatabaseSync;
  seed(rows: SeedRow[]): void;
  plan(sql: string, bindings?: Bindable[]): string[];
  close(): void;
}

export interface SeedRow {
  email: string;
  name?: string;
  source?: string;
  amount?: string;
  months?: string;
  question?: string;
  updates_opt_in?: number;
  is_foss_user?: number | null;
  is_foss_contributor?: number | null;
  is_student?: number | null;
  exported_at?: number | null;
  unsubscribed_at?: number | null;
  created_at?: number;
}

const SEED_SQL = `INSERT INTO waitlist
    (email, name, consent_at, source, amount, months, question, updates_opt_in,
     is_foss_user, is_foss_contributor, is_student,
     exported_at, unsubscribed_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function statementOf(raw: DatabaseSync, sql: string, bindings: Bindable[]) {
  return {
    bind: (...next: Bindable[]) => statementOf(raw, sql, next),
    all: async () => ({
      success: true,
      results: raw.prepare(sql).all(...bindings),
      meta: {},
    }),
    first: async (column?: string) => {
      const row = raw.prepare(sql).get(...bindings) as Record<string, unknown> | undefined;
      if (row === undefined) return null;
      return column === undefined ? row : (row[column] ?? null);
    },
    run: async () => {
      raw.prepare(sql).run(...bindings);
      return { success: true, meta: {} };
    },
  };
}

export function makeSqlite(): SqliteFixture {
  const raw = new DatabaseSync(":memory:");
  for (const file of migrationFiles()) {
    raw.exec(readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8"));
  }

  const db = {
    prepare: (sql: string) => statementOf(raw, sql, []),
    batch: async (statements: { all(): Promise<unknown> }[]) =>
      Promise.all(statements.map((s) => s.all())),
  } as unknown as AdminEnv["DB"];

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
          row.amount ?? "500",
          row.months ?? "12",
          row.question ?? "",
          row.updates_opt_in ?? 1,
          row.is_foss_user ?? null,
          row.is_foss_contributor ?? null,
          row.is_student ?? null,
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
