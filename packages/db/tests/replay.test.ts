import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, migratedD1, migrationFiles, rowsOf } from "../src/testing.ts";

const RETIRED = [
  "0002_waitlist.sql",
  "0003_voting.sql",
  "0004_proposal_options.sql",
  "0002_waitlist_launch.sql",
  "0003_voting_post_launch.sql",
];

describe("wrangler resolves migrations by filename, so a name may never be reused", () => {
  it("ships the migration files in order", () => {
    expect(migrationFiles()).toEqual([
      "0001_init.sql",
      "0002_contribution_intent.sql",
      "0003_updates_opt_in.sql",
      "0004_audience_roles.sql",
      "0005_signup_data.sql",
      "0006_fill_old_answers.sql",
    ]);
  });

  it("holds no subdirectory, which the migration list would skip", () => {
    const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
    expect(entries.filter((e) => e.isDirectory()).map((e) => e.name)).toEqual([]);
  });

  it("uses no filename that this repository has retired", () => {
    expect(migrationFiles().filter((f) => RETIRED.includes(f))).toEqual([]);
  });
});

describe("the migrated waitlist table", () => {
  it("has exactly the columns the Worker and the exporter use", () => {
    const columns = rowsOf(migratedD1().raw, "PRAGMA table_info(waitlist)").map((r) => r.name);
    expect(columns).toEqual([
      "id",
      "email",
      "name",
      "consent_at",
      "source",
      "exported_at",
      "unsubscribed_at",
      "created_at",
      "updated_at",
      "amount",
      "months",
      "question",
      "updates_opt_in",
      "is_user",
      "is_creator",
      "is_professional",
      "is_student",
      "backs_nascent",
      "backs_growing",
      "backs_larger",
    ]);
  });

  it("requires a consent timestamp, because consent cannot be backfilled", () => {
    const info = rowsOf(migratedD1().raw, "PRAGMA table_info(waitlist)").find(
      (r) => r.name === "consent_at",
    );
    expect(info?.notnull).toBe(1);
  });

  it("keeps both partial indexes and no working table", () => {
    const sql = `SELECT type || ' ' || name AS o FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%' ORDER BY o`;
    const objects = rowsOf(migratedD1().raw, sql).map((r) => r.o);
    expect(objects).toEqual([
      "index idx_waitlist_pending_export",
      "index idx_waitlist_question",
      "table waitlist",
    ]);
  });

  for (const [label, column, value] of [
    ["an amount in words", "amount", "1k"],
    ["an amount of zero", "amount", 0],
    ["a fraction of a rupee", "amount", 3.14],
    ["a role other than 0 or 1", "is_user", 2],
    ["a reason other than 0 or 1", "backs_larger", 2],
  ] as const) {
    it(`refuses ${label}`, () => {
      const insert = migratedD1().raw.prepare(
        `INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at, ${column})
         VALUES ('x@example.com', 'X', 1, 'subscribe', 1, 1, ?)`,
      );
      expect(() => insert.run(value)).toThrow(/CHECK constraint failed/);
    });
  }
});
