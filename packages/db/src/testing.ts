import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url).href);

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

type Row = Record<string, unknown>;

function statementFor(db: DatabaseSync, sql: string, args: unknown[]) {
  return {
    bind: (...next: unknown[]) => statementFor(db, sql, next),
    async run() {
      const r = db.prepare(sql).run(...(args as never[]));
      return { success: true, meta: { changes: Number(r.changes) } };
    },
    async all<T>() {
      return { success: true, results: db.prepare(sql).all(...(args as never[])) as T[] };
    },
    async first<T>() {
      return (db.prepare(sql).get(...(args as never[])) as T | undefined) ?? null;
    },
  };
}

export function migratedD1(): {
  db: D1Database;
  raw: DatabaseSync;
} {
  const raw = new DatabaseSync(":memory:");
  for (const name of migrationFiles()) {
    raw.exec(readFileSync(`${MIGRATIONS_DIR}/${name}`, "utf8"));
  }
  const db = {
    prepare: (sql: string) => statementFor(raw, sql, []),
  } as unknown as D1Database;
  return { db, raw };
}

export function rowsOf(raw: DatabaseSync, sql: string): Row[] {
  return raw.prepare(sql).all() as Row[];
}
