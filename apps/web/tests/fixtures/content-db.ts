import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Query } from "../../src/lib/guard-store.ts";

type Value = string | number | null;

const D1_COMPOUND_SELECT = 5;

const D1_LIKE_PATTERN = 50;

export interface ContentDb {
  query: Query;
  run: (sql: string, ...params: Value[]) => void;
  rows: <T>(sql: string, ...params: Value[]) => T[];
  close: () => void;
}

export function seedContentDb(): ContentDb {
  const dir = mkdtempSync(join(tmpdir(), "content-db-"));
  const seed = JSON.parse(readFileSync("seed/seed.json", "utf8"));
  const { posts } = JSON.parse(readFileSync("tests/fixtures/content/posts.json", "utf8"));
  seed.content.posts = posts;
  writeFileSync(join(dir, "seed.json"), JSON.stringify(seed));
  execFileSync(
    resolve("node_modules/.bin/emdash"),
    ["seed", join(dir, "seed.json"), "-d", join(dir, "content.db")],
    { stdio: "ignore" },
  );
  const db = new DatabaseSync(join(dir, "content.db"));
  db.limits.compoundSelect = D1_COMPOUND_SELECT;
  db.limits.likePatternLength = D1_LIKE_PATTERN;
  return {
    query: async (sql, params) =>
      db.prepare(sql).all(...(params as Value[])) as Record<string, unknown>[],
    run: (sql, ...params) => {
      db.prepare(sql).run(...params);
    },
    rows: <T>(sql: string, ...params: Value[]) => db.prepare(sql).all(...params) as T[],
    close: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
