import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, migrationFiles } from "../src/testing.ts";

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
      "0005_signup_data.sql",
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
      "is_user",
      "is_creator",
      "is_professional",
      "is_student",
      "backs_nascent",
      "backs_growing",
      "backs_larger",
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

const OPT_IN_MS = Date.parse("2026-09-12T03:42:54Z");

const PRE_0005_INSERT = `INSERT INTO waitlist
  (email, name, consent_at, source, created_at, updated_at, amount, updates_opt_in,
   is_foss_user, is_foss_contributor, is_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

type Old = [string, number, string | null, number, number | null, number | null, number | null];

const OLD_ROWS: Old[] = [
  ["before@example.com", OPT_IN_MS - 1000, "1,000", 1, null, null, null],
  ["rupee@example.com", OPT_IN_MS + 1000, "₹500", 1, 1, 0, 1],
  ["words@example.com", OPT_IN_MS + 2000, "1k", 0, 0, 1, 0],
  ["zero@example.com", OPT_IN_MS + 3000, "0", 1, null, null, null],
  ["blank@example.com", OPT_IN_MS + 4000, "", 0, null, null, null],
  ["none@example.com", OPT_IN_MS + 5000, null, 0, null, null, null],
  ["rs@example.com", OPT_IN_MS + 6000, "Rs. 250/-", 1, null, null, null],
  ["pad@example.com", OPT_IN_MS + 7000, " 128 ", 1, null, null, null],
  ["gone@example.com", OPT_IN_MS + 8000, "15", 1, null, null, null],
];

function before0005(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const name of migrationFiles().filter((f) => f < "0005")) {
    db.exec(readFileSync(`${MIGRATIONS_DIR}/${name}`, "utf8"));
  }
  for (const [email, at, amount, updates, user, contributor, student] of OLD_ROWS) {
    db.prepare(PRE_0005_INSERT).run(
      email,
      "N",
      at,
      "subscribe",
      at,
      at,
      amount,
      updates,
      user,
      contributor,
      student,
    );
  }
  db.prepare("DELETE FROM waitlist WHERE email = ?").run("gone@example.com");
  return db;
}

function after0005(): DatabaseSync {
  const db = before0005();
  db.exec(readFileSync(`${MIGRATIONS_DIR}/0005_signup_data.sql`, "utf8"));
  return db;
}

function byEmail(db: DatabaseSync, name: string): Record<string, unknown> {
  const rows = db.prepare(`SELECT email, ${name} FROM waitlist ORDER BY id`).all();
  return Object.fromEntries(rows.map((r) => [r.email, r[name]]));
}

describe("0005 rebuilds waitlist for the #14 data and normalises the rows", () => {
  it("keeps every row under its old id", () => {
    const ids = (db: DatabaseSync) =>
      db.prepare("SELECT id, email FROM waitlist ORDER BY id").all();
    expect(ids(after0005())).toEqual(ids(before0005()));
  });

  it("turns each amount into a whole number of rupees, or NULL when it is not one", () => {
    expect(byEmail(after0005(), "amount")).toEqual({
      "before@example.com": 1000,
      "rupee@example.com": 500,
      "words@example.com": null,
      "zero@example.com": null,
      "blank@example.com": null,
      "none@example.com": null,
      "rs@example.com": 250,
      "pad@example.com": 128,
    });
  });

  it("marks the update choice as not asked for a row from before the updates box went live", () => {
    expect(byEmail(after0005(), "updates_opt_in")).toMatchObject({
      "before@example.com": null,
      "rupee@example.com": 1,
      "words@example.com": 0,
    });
  });

  it("carries each old role to its #14 name and asks nobody the new questions", () => {
    const db = after0005();
    const row = db
      .prepare(
        `SELECT is_user, is_creator, is_professional, is_student,
           backs_nascent, backs_growing, backs_larger FROM waitlist WHERE email = ?`,
      )
      .get("rupee@example.com");
    expect(row).toEqual({
      is_user: 1,
      is_creator: 0,
      is_professional: null,
      is_student: 1,
      backs_nascent: null,
      backs_growing: null,
      backs_larger: null,
    });
  });

  it("never reuses the id of a deleted row", () => {
    const db = after0005();
    const { id } = db
      .prepare(
        `INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at)
         VALUES ('next@example.com', 'N', 1, 'subscribe', 1, 1) RETURNING id`,
      )
      .get() as { id: number };
    expect(id).toBe(OLD_ROWS.length + 1);
  });

  it("never reuses an id when every row was deleted before it ran", () => {
    const db = before0005();
    db.exec("DELETE FROM waitlist");
    db.exec(readFileSync(`${MIGRATIONS_DIR}/0005_signup_data.sql`, "utf8"));
    const { id } = db
      .prepare(
        `INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at)
         VALUES ('next@example.com', 'N', 1, 'subscribe', 1, 1) RETURNING id`,
      )
      .get() as { id: number };
    expect(id).toBe(OLD_ROWS.length + 1);
  });

  it("rebuilds both partial indexes and leaves no working table behind", () => {
    expect(schemaOf(after0005())).toEqual([
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
      const insert = after0005().prepare(
        `INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at, ${column})
         VALUES ('x@example.com', 'X', 1, 'subscribe', 1, 1, ?)`,
      );
      expect(() => insert.run(value)).toThrow(/CHECK constraint failed/);
    });
  }
});
