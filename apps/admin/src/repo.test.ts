import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdminRepo, type AdminRepo } from "./repo.ts";
import {
  AMOUNTS_SQL,
  DAILY_DAYS,
  DAILY_SQL,
  DAY_MS,
  PAGE_SIZE,
  PAGE_SQL,
  QUESTIONS_SQL,
  RATE_DAYS,
  REVEAL_SQL,
  TOTALS_SQL,
} from "./sql.ts";
import { makeSqlite, type SqliteFixture } from "./testkit-sqlite.ts";

const SEED_COUNT = PAGE_SIZE * 2;
const NOW = Date.UTC(2026, 9, 1);

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
      amount: i % 3 === 0 ? 500 : 1000,
      months: "12",
    })),
  );
}

describe("the list page", () => {
  for (const [email, masked] of [
    ["first.last@gmail.com", "••••@•••••.com"],
    ["a@example.co.in", "••••@•••••.co.in"],
    ["a@cs.iitb.ac.in", "••••@•••••.ac.in"],
    ["a@mail.ibm.com", "••••@•••••.com"],
    ["a@x.com.au", "••••@•••••.com.au"],
    ["a@localhost", "••••@•••••"],
    ["a@example.dev", "••••@•••••.dev"],
    ["a@bank.sbi", "••••@•••••"],
    ["a@corp.microsoft", "••••@•••••"],
    ["jane.doe@example.janedoe1990", "••••@•••••"],
    ["a@x.com.microsoft", "••••@•••••"],
    ["a@[10.0.0.1]", "••••@•••••"],
  ] as const) {
    it(`shows no name, length or organisation for ${email}`, async () => {
      fixture.seed([{ email }]);
      const [row] = await repo.page(Number.MAX_SAFE_INTEGER);
      expect(row?.email_masked).toBe(masked);
    });
  }

  it("returns no field holding a raw address", async () => {
    seedMany(SEED_COUNT);
    const rows = await repo.page(Number.MAX_SAFE_INTEGER);
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
    expect((rows[0] as { email_masked: string }).email_masked).toBe("••••@•••••");
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

  it("carries every column of the 0005 schema, the address masked", async () => {
    fixture.seed([
      { email: "boxes@example.org", is_user: 1, is_professional: null, backs_larger: 0 },
    ]);
    const [row] = await repo.page(Number.MAX_SAFE_INTEGER);
    const columns = fixture.raw.prepare("SELECT name FROM pragma_table_info('waitlist')").all();
    const expected = columns
      .map((column) => String(column.name))
      .filter((name) => name !== "email" && name !== "question");
    expect(Object.keys(row ?? {})).toEqual(expect.arrayContaining(expected));
    expect([row?.is_user, row?.is_professional, row?.backs_larger]).toEqual([1, null, 0]);
  });
});

describe("the questions query", () => {
  it("returns only a row that carries a question", async () => {
    fixture.seed([
      { email: "a@example.org", question: "" },
      { email: "b@example.org", question: "How do I help?" },
      { email: "c@example.org" },
    ]);
    const rows = await repo.questions(Number.MAX_SAFE_INTEGER);
    expect(rows.map((row) => row.question)).toEqual(["How do I help?"]);
  });

  it("carries the export stamp, so a question shows the status a record shows", async () => {
    fixture.seed([{ email: "a@example.org", question: "why?", exported_at: 7 }]);
    const [row] = await repo.questions(Number.MAX_SAFE_INTEGER);
    expect(row?.exported_at).toBe(7);
  });

  it("carries the columns the questions table shows, and no role or pledge", async () => {
    fixture.seed([{ email: "a@example.org", question: "why?" }]);
    const [row] = await repo.questions(Number.MAX_SAFE_INTEGER);
    expect(Object.keys(row ?? {})).toEqual([
      "id",
      "email_masked",
      "name",
      "question",
      "created_at",
      "exported_at",
      "unsubscribed_at",
    ]);
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
  it("searches the primary key instead of scanning the table", () => {
    const plan = fixture.plan(REVEAL_SQL, [1]).join(" ");
    expect(plan).toContain("SEARCH");
    expect(plan).not.toContain("SCAN");
  });
});

describe("the summary", () => {
  it("does not count an exported row that later unsubscribed as pending", async () => {
    fixture.seed([{ email: "a@example.org", exported_at: 7, unsubscribed_at: 9 }]);
    const { totals } = await repo.summary(NOW);
    expect(totals.pending).toBe(0);
  });

  it("counts an empty table without failing", async () => {
    expect(await repo.summary(NOW)).toEqual({
      asOf: NOW,
      totals: {
        total: 0,
        active: 0,
        pending: 0,
        recent_joined: 0,
        recent_left: 0,
        updates_opt_in: 0,
        updates_asked: 0,
        roles_answered: 0,
        reasons_answered: 0,
        questions: 0,
        is_user: 0,
        is_creator: 0,
        is_professional: 0,
        is_student: 0,
        backs_nascent: 0,
        backs_growing: 0,
        backs_larger: 0,
      },
      pledges: { count: 0, sum: 0, median: null },
      byDay: [],
    });
  });

  it("counts the rows in one pass", async () => {
    fixture.seed([
      { email: "a@example.org" },
      { email: "b@example.org", unsubscribed_at: 5 },
      { email: "c@example.org", exported_at: 7, question: "why?" },
      { email: "d@example.org", updates_opt_in: null },
    ]);
    const { totals } = await repo.summary(NOW);
    expect(totals).toEqual({
      total: 4,
      active: 3,
      pending: 2,
      recent_joined: 0,
      recent_left: 0,
      updates_opt_in: 2,
      updates_asked: 2,
      roles_answered: 0,
      reasons_answered: 0,
      questions: 1,
      is_user: 0,
      is_creator: 0,
      is_professional: 0,
      is_student: 0,
      backs_nascent: 0,
      backs_growing: 0,
      backs_larger: 0,
    });
  });

  it("keeps an unsubscribed row in the list totals and out of every interest figure", async () => {
    const recent = { created_at: NOW - DAY_MS, is_user: 1 as const, backs_nascent: 1 as const };
    fixture.seed([{ email: "a@example.org", amount: 128, question: "why?", ...recent }]);
    const before = await repo.summary(NOW);
    fixture.seed([
      { email: "b@example.org", amount: 512, question: "how?", unsubscribed_at: NOW, ...recent },
    ]);
    const after = await repo.summary(NOW);
    expect(after).toEqual({ ...before, totals: { ...before.totals, total: 2, questions: 2 } });
  });

  it("counts each audience role, and adds a row from before 0004 to no count", async () => {
    fixture.seed([
      { email: "a@example.org", is_user: 1, is_creator: 1 },
      { email: "b@example.org", is_user: 1, is_student: 1, is_professional: 1 },
      { email: "c@example.org", is_user: 0, is_creator: 0, is_professional: 0, is_student: 0 },
      { email: "d@example.org" },
    ]);
    const { totals } = await repo.summary(NOW);
    expect(totals).toMatchObject({ is_user: 2, is_creator: 1, is_professional: 1, is_student: 1 });
  });

  it("counts the active people who answered each group, not the boxes they ticked", async () => {
    fixture.seed([
      { email: "a@example.org", is_user: 1, is_creator: 1, backs_nascent: 1 },
      { email: "b@example.org", is_user: 0, is_creator: 0, is_professional: 0, is_student: 0 },
      { email: "c@example.org" },
      { email: "d@example.org", is_user: 1, backs_larger: 1, unsubscribed_at: 5 },
    ]);
    const { totals } = await repo.summary(NOW);
    expect([totals.roles_answered, totals.reasons_answered]).toEqual([2, 1]);
  });

  it("counts each reason for joining, and a row the form never asked to no count", async () => {
    fixture.seed([
      { email: "a@example.org", backs_nascent: 1, backs_larger: 1 },
      { email: "b@example.org", backs_nascent: 1, backs_growing: 0 },
      { email: "c@example.org" },
    ]);
    const { totals } = await repo.summary(NOW);
    expect(totals).toMatchObject({ backs_nascent: 2, backs_growing: 0, backs_larger: 1 });
  });

  it("counts who joined and who left in the last 30 days, for the current rate", async () => {
    const since = NOW - RATE_DAYS * DAY_MS;
    fixture.seed([
      { email: "a@example.org", created_at: since },
      { email: "b@example.org", created_at: since - 1 },
      { email: "c@example.org", created_at: NOW - 1 },
      { email: "d@example.org", created_at: NOW - 1, unsubscribed_at: NOW },
      { email: "e@example.org", created_at: since - 1, unsubscribed_at: since },
      { email: "f@example.org", created_at: since - 2, unsubscribed_at: since - 1 },
    ]);
    const { totals } = await repo.summary(NOW);
    expect([totals.recent_joined, totals.recent_left]).toEqual([2, 1]);
  });

  it("sums the monthly pledges, and takes the middle amount of those who gave one", async () => {
    fixture.seed([
      { email: "a@example.org", amount: 15 },
      { email: "b@example.org", amount: 128 },
      { email: "c@example.org", amount: 128 },
      { email: "d@example.org", amount: 512 },
      { email: "e@example.org", amount: 9999 },
      { email: "f@example.org", amount: null },
    ]);
    const { pledges } = await repo.summary(NOW);
    expect(pledges).toEqual({ count: 5, sum: 10782, median: 128 });
  });

  it("takes the mean of the two middle amounts when the count is even", async () => {
    fixture.seed([
      { email: "a@example.org", amount: 15 },
      { email: "b@example.org", amount: 128 },
    ]);
    const { pledges } = await repo.summary(NOW);
    expect(pledges.median).toBe(71.5);
  });

  it("costs three table passes and two groupings, the budget ARCHITECTURE.md 10.4 states", () => {
    const plans = [
      fixture.plan(TOTALS_SQL, [NOW]),
      fixture.plan(AMOUNTS_SQL),
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
    const { byDay } = await repo.summary(NOW);
    expect(byDay).toEqual([
      { key: "2026-01-01", n: 2 },
      { key: "2026-01-03", n: 1 },
    ]);
  });
});
