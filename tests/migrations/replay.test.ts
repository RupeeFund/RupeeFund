import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, migrationFiles } from "./d1-adapter.ts";

const EXPECTED_TABLES = ["waitlist"];

const RETIRED = [
  "0002_waitlist.sql",
  "0003_voting.sql",
  "0004_proposal_options.sql",
  "0002_waitlist_launch.sql",
  "0003_voting_post_launch.sql",
];

const LEDGER_DDL =
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)";

const PRE_0002_INSERT = `INSERT INTO waitlist
  (email, name, consent_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;

function replay(alreadyRecorded: string[] = []): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(LEDGER_DDL);
  for (const name of alreadyRecorded) {
    db.exec(readFileSync(`${MIGRATIONS_DIR}/${name}`, "utf8"));
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  }
  for (const name of migrationFiles()) {
    const seen = db.prepare("SELECT COUNT(*) AS n FROM d1_migrations WHERE name = ?").get(name);
    if ((seen as { n: number }).n > 0) continue;
    db.exec(readFileSync(`${MIGRATIONS_DIR}/${name}`, "utf8"));
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  }
  return db;
}

function schemaOf(db: DatabaseSync): string[] {
  return db
    .prepare(
      "SELECT type || ' ' || name AS o FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != 'd1_migrations' ORDER BY o",
    )
    .all()
    .map((r) => (r as { o: string }).o);
}

function tablesOf(db: DatabaseSync): string[] {
  return schemaOf(db)
    .filter((o) => o.startsWith("table "))
    .map((o) => o.slice(6))
    .sort();
}

describe("one migrations directory feeds both databases", () => {
  it("ships the migration files in order", () => {
    expect(migrationFiles()).toEqual([
      "0001_init.sql",
      "0002_contribution_intent.sql",
      "0003_updates_opt_in.sql",
      "0004_audience_roles.sql",
    ]);
  });

  it("holds no per-environment subdirectory, which is what let the two copies drift", () => {
    const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
    expect(entries.filter((e) => e.isDirectory()).map((e) => e.name)).toEqual([]);
  });

  it("builds the whole schema from that one file", () => {
    expect(tablesOf(replay())).toEqual(EXPECTED_TABLES);
  });

  it("applies nothing to a database that already recorded every file", () => {
    const files = migrationFiles();
    const db = replay(files);
    const ledger = db
      .prepare("SELECT name FROM d1_migrations ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(ledger).toEqual(files);
    expect(tablesOf(db)).toEqual(EXPECTED_TABLES);
  });
});

describe("wrangler resolves migrations by filename, so a name may never be reused", () => {
  it("uses no filename that this repository has retired", () => {
    expect(migrationFiles().filter((f) => RETIRED.includes(f))).toEqual([]);
  });

  it("still converges if a later migration is ever added", () => {
    const earlier = migrationFiles().slice(0, -1);
    expect(schemaOf(replay())).toEqual(schemaOf(replay(earlier)));
  });
});

describe("the waitlist table records consent and export state", () => {
  it("has exactly the columns the Worker and the exporter use", () => {
    const columns = replay()
      .prepare("PRAGMA table_info(waitlist)")
      .all()
      .map((r) => (r as { name: string }).name);
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
      "is_foss_user",
      "is_foss_contributor",
      "is_student",
    ]);
  });

  for (const column of ["amount", "months", "question"]) {
    it(`leaves ${column} nullable, because the rows written before 0002 have no answer`, () => {
      const info = replay()
        .prepare("PRAGMA table_info(waitlist)")
        .all()
        .find((r) => (r as { name: string }).name === column);
      expect((info as { notnull: number }).notnull).toBe(0);
    });
  }

  it("accepts an insert that names no answer, which a pre-0002 Worker still sends", () => {
    const db = replay();
    db.prepare(PRE_0002_INSERT).run("old@example.com", "O", 1000, "subscribe", 1000, 1000);
    const row = db.prepare("SELECT amount FROM waitlist WHERE email = ?").get("old@example.com");
    expect((row as { amount: string | null }).amount).toBe(null);
  });

  it("opts in every row that exists when 0003 runs, and no row written after it", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readFileSync(`${MIGRATIONS_DIR}/0001_init.sql`, "utf8"));
    db.exec(readFileSync(`${MIGRATIONS_DIR}/0002_contribution_intent.sql`, "utf8"));
    db.prepare(PRE_0002_INSERT).run("before@example.com", "B", 1000, "subscribe", 1000, 1000);
    db.exec(readFileSync(`${MIGRATIONS_DIR}/0003_updates_opt_in.sql`, "utf8"));
    db.prepare(PRE_0002_INSERT).run("after@example.com", "A", 2000, "subscribe", 2000, 2000);
    const rows = db.prepare("SELECT email, updates_opt_in FROM waitlist ORDER BY id").all() as {
      email: string;
      updates_opt_in: number;
    }[];
    expect(rows).toEqual([
      { email: "before@example.com", updates_opt_in: 1 },
      { email: "after@example.com", updates_opt_in: 0 },
    ]);
  });

  it("0004 asks no role of an older row, and reads a tick apart from a blank", () => {
    const db = new DatabaseSync(":memory:");
    for (const name of [
      "0001_init.sql",
      "0002_contribution_intent.sql",
      "0003_updates_opt_in.sql",
    ]) {
      db.exec(readFileSync(`${MIGRATIONS_DIR}/${name}`, "utf8"));
    }
    db.prepare(PRE_0002_INSERT).run("before@example.com", "B", 1000, "subscribe", 1000, 1000);
    db.exec(readFileSync(`${MIGRATIONS_DIR}/0004_audience_roles.sql`, "utf8"));
    db.prepare(
      `INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at,
         is_foss_user, is_foss_contributor, is_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("after@example.com", "A", 2000, "subscribe", 2000, 2000, 1, 0, 0);

    expect(
      db
        .prepare(
          "SELECT email, is_foss_user, is_foss_contributor, is_student FROM waitlist ORDER BY id",
        )
        .all(),
    ).toEqual([
      {
        email: "before@example.com",
        is_foss_user: null,
        is_foss_contributor: null,
        is_student: null,
      },
      { email: "after@example.com", is_foss_user: 1, is_foss_contributor: 0, is_student: 0 },
    ]);
  });

  it("requires a consent timestamp, because consent cannot be backfilled", () => {
    const info = replay()
      .prepare("PRAGMA table_info(waitlist)")
      .all()
      .find((r) => (r as { name: string }).name === "consent_at");
    expect((info as { notnull: number }).notnull).toBe(1);
  });
});
