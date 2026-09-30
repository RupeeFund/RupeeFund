import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdminRepo, type AdminRepo } from "./repo.ts";
import {
  DAILY_DAYS,
  DAILY_SQL,
  PAGE_SIZE,
  PAGE_SQL,
  QUESTIONS_SQL,
  REVEAL_SQL,
  SLICES_SQL,
  TOTALS_SQL,
} from "./sql.ts";
import { makeSqlite, type SqliteFixture } from "./testkit-sqlite.ts";

const SEED_COUNT = 1004;

let fixture: SqliteFixture;
let repo: AdminRepo;

beforeEach(() => {
  fixture = makeSqlite();
  repo = createAdminRepo(fixture.db);
});

afterEach(() => {
  fixture.close();
});

function seedMany(count: number): void {
  fixture.seed(
    Array.from({ length: count }, (_, i) => ({
      email: `person${i}@example.org`,
      source: i % 2 === 0 ? "subscribe" : "home",
      amount: i % 3 === 0 ? "500" : "1000",
      months: "12",
    })),
  );
}

describe("the list page", () => {
  it("masks the email of every row", async () => {
    fixture.seed([{ email: "someone@example.org" }]);
    const [row] = await repo.page(Number.MAX_SAFE_INTEGER);
    expect(row?.email_masked).toBe("s•••@example.org");
  });

  it("returns no field holding a raw address", async () => {
    seedMany(SEED_COUNT);
    const rows = await repo.page(Number.MAX_SAFE_INTEGER);
    expect(JSON.stringify(rows)).not.toContain("@example.org".replace("@", "0@"));
    for (const row of rows) {
      expect(Object.values(row).join(" ")).not.toContain("person");
    }
  });

  it("masks an address that carries no at sign", () => {
    fixture.raw
      .prepare(
        `INSERT INTO waitlist (email, name, consent_at, source, updates_opt_in, created_at, updated_at)
         VALUES ('broken', 'A Person', 1, 'subscribe', 1, 1, 1)`,
      )
      .run();
    const rows = fixture.raw.prepare(PAGE_SQL).all(Number.MAX_SAFE_INTEGER, PAGE_SIZE);
    expect((rows[0] as { email_masked: string }).email_masked).toBe("•••");
  });

  it("reads no more than the page size", async () => {
    seedMany(SEED_COUNT);
    const rows = await repo.page(Number.MAX_SAFE_INTEGER);
    expect(rows).toHaveLength(PAGE_SIZE);
  });

  it("searches the primary key instead of scanning the table", () => {
    const plan = fixture.plan(PAGE_SQL, [Number.MAX_SAFE_INTEGER, PAGE_SIZE]).join(" ");
    expect(plan).toContain("SEARCH");
    expect(plan).not.toContain("SCAN");
  });

  it("walks backwards from a cursor without re-reading the first page", async () => {
    seedMany(SEED_COUNT);
    const first = await repo.page(Number.MAX_SAFE_INTEGER);
    const last = first.at(-1);
    const second = await repo.page(last?.id ?? 0);
    expect(second).toHaveLength(PAGE_SIZE);
    expect(second[0]?.id).toBe((last?.id ?? 0) - 1);
  });

  it("names no audience role in the row page, because a count is all it shows", () => {
    for (const column of ["is_foss_user", "is_foss_contributor", "is_student"]) {
      expect(PAGE_SQL).not.toContain(column);
    }
  });

  it("carries a flag for a question, never the question itself", async () => {
    fixture.seed([{ email: "asks@example.org", question: "<img src=x onerror=alert(1)>" }]);
    const [row] = await repo.page(Number.MAX_SAFE_INTEGER);
    expect(row?.has_question).toBe(1);
    expect(JSON.stringify(row)).not.toContain("onerror");
  });
});

describe("the questions page", () => {
  it("returns only a row that carries a question", async () => {
    fixture.seed([
      { email: "a@example.org", question: "" },
      { email: "b@example.org", question: "How do I help?" },
      { email: "c@example.org" },
    ]);
    const rows = await repo.questions(Number.MAX_SAFE_INTEGER);
    expect(rows.map((row) => row.question)).toEqual(["How do I help?"]);
  });

  it("masks the email of every row", async () => {
    fixture.seed([{ email: "someone@example.org", question: "why?" }]);
    const [row] = await repo.questions(Number.MAX_SAFE_INTEGER);
    expect(row?.email_masked).toBe("s•••@example.org");
    expect(JSON.stringify(row)).not.toContain("someone@example.org");
  });

  it("names no audience role and no pledge, because the page shows neither", () => {
    for (const column of ["is_foss_user", "is_foss_contributor", "is_student", "amount"]) {
      expect(QUESTIONS_SQL).not.toContain(column);
    }
  });

  it("reads no more than the page size", async () => {
    fixture.seed(
      Array.from({ length: PAGE_SIZE + 10 }, (_, i) => ({
        email: `p${i}@example.org`,
        question: "why?",
      })),
    );
    expect(await repo.questions(Number.MAX_SAFE_INTEGER)).toHaveLength(PAGE_SIZE);
  });

  it("walks backwards from a cursor, newest first", async () => {
    fixture.seed(
      Array.from({ length: 4 }, (_, i) => ({ email: `p${i}@example.org`, question: `q${i}` })),
    );
    const rows = await repo.questions(Number.MAX_SAFE_INTEGER);
    expect(rows.map((row) => row.id)).toEqual([4, 3, 2, 1]);
    expect((await repo.questions(3)).map((row) => row.id)).toEqual([2, 1]);
  });

  it("reads through the partial index rather than every row of the table", () => {
    const plan = fixture.plan(QUESTIONS_SQL, [Number.MAX_SAFE_INTEGER, PAGE_SIZE]).join(" ");
    expect(plan).toContain("idx_waitlist_question");
    expect(plan).not.toContain("SCAN");
  });
});

describe("the reveal query", () => {
  it("returns the one address asked for", async () => {
    fixture.seed([{ email: "first@example.org" }, { email: "second@example.org" }]);
    expect(await repo.reveal(2)).toBe("second@example.org");
  });

  it("returns nothing for a row that is absent", async () => {
    fixture.seed([{ email: "first@example.org" }]);
    expect(await repo.reveal(99)).toBeNull();
  });

  it("searches the primary key instead of scanning the table", () => {
    const plan = fixture.plan(REVEAL_SQL, [1]).join(" ");
    expect(plan).toContain("SEARCH");
    expect(plan).not.toContain("SCAN");
  });
});

describe("the summary", () => {
  it("counts an empty table without failing", async () => {
    const summary = await repo.summary();
    expect(summary.totals).toEqual({
      total: 0,
      active: 0,
      exported: 0,
      updates_opt_in: 0,
      questions: 0,
      foss_users: 0,
      foss_contributors: 0,
      students: 0,
    });
  });

  it("counts the rows in one pass", async () => {
    fixture.seed([
      { email: "a@example.org" },
      { email: "b@example.org", unsubscribed_at: 5 },
      { email: "c@example.org", exported_at: 7, question: "why?" },
    ]);
    const { totals } = await repo.summary();
    expect(totals).toEqual({
      total: 3,
      active: 2,
      exported: 1,
      updates_opt_in: 3,
      questions: 1,
      foss_users: 0,
      foss_contributors: 0,
      students: 0,
    });
  });

  it("counts each audience role, and adds a row from before 0004 to no count", async () => {
    fixture.seed([
      { email: "a@example.org", is_foss_user: 1, is_foss_contributor: 1 },
      { email: "b@example.org", is_foss_user: 1, is_student: 1 },
      { email: "c@example.org", is_foss_user: 0, is_foss_contributor: 0, is_student: 0 },
      { email: "d@example.org" },
    ]);
    const { totals } = await repo.summary();
    expect(totals.foss_users).toBe(2);
    expect(totals.foss_contributors).toBe(1);
    expect(totals.students).toBe(1);
  });

  it("slices by source, amount and months from one grouped query", async () => {
    seedMany(9);
    const summary = await repo.summary();
    expect(summary.bySource).toEqual([
      { key: "subscribe", n: 5 },
      { key: "home", n: 4 },
    ]);
    expect(summary.byAmount).toEqual([
      { key: "1000", n: 6 },
      { key: "500", n: 3 },
    ]);
    expect(summary.byMonths).toEqual([{ key: "12", n: 9 }]);
  });

  it("costs five table passes, the budget docs/architecture.md section 10.4 states", () => {
    const plans = [
      fixture.plan(TOTALS_SQL),
      fixture.plan(SLICES_SQL),
      fixture.plan(DAILY_SQL, [DAILY_DAYS]),
    ].flat();
    const scans = plans.filter((line) => line.startsWith("SCAN"));
    const groupings = plans.filter((line) => line.includes("TEMP B-TREE"));
    expect(scans).toHaveLength(3);
    expect(groupings).toHaveLength(2);
  });

  it("reports the signups per day oldest first", async () => {
    fixture.seed([
      { email: "a@example.org", created_at: Date.UTC(2026, 0, 1) },
      { email: "b@example.org", created_at: Date.UTC(2026, 0, 1) },
      { email: "c@example.org", created_at: Date.UTC(2026, 0, 3) },
    ]);
    const { byDay } = await repo.summary();
    expect(byDay).toEqual([
      { key: "2026-01-01", n: 2 },
      { key: "2026-01-03", n: 1 },
    ]);
  });
});
