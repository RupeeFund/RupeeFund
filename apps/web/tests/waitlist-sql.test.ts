import { beforeEach, describe, expect, it } from "vitest";
import { BATCH, claimPending, COUNT_PENDING, SELECT_PENDING } from "@rupeefund/db/export";
import { createRepo } from "../src/worker/lib/db.ts";
import type { Repo, WaitlistEntry } from "../src/worker/types.ts";
import { migratedD1, rowsOf } from "@rupeefund/db/testing";
import type { DatabaseSync } from "node:sqlite";

function claim(raw: DatabaseSync, at: number): { id: number; email: string }[] {
  return rowsOf(raw, claimPending(at)) as unknown as { id: number; email: string }[];
}

function markUnsubscribedAsTheOperatorRunsIt(raw: DatabaseSync, email: string, at: number): number {
  const res = raw
    .prepare(
      `UPDATE waitlist SET unsubscribed_at = ${at}, updated_at = ${at}
       WHERE email = ? AND unsubscribed_at IS NULL`,
    )
    .run(email);
  return Number(res.changes);
}

function pending(raw: DatabaseSync): { id: number; email: string }[] {
  return rowsOf(raw, SELECT_PENDING) as unknown as {
    id: number;
    email: string;
  }[];
}

function entry(over: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    email: "asha@example.com",
    name: "Asha",
    consent_at: 1000,
    source: "subscribe",
    created_at: 1000,
    updated_at: 1000,
    amount: 100,
    months: "12",
    question: "Who audits this?",
    updates_opt_in: 1,
    is_user: 1,
    is_creator: 0,
    is_professional: 0,
    is_student: 0,
    backs_nascent: 0,
    backs_growing: 1,
    backs_larger: 0,
    ...over,
  };
}

describe("the signup SQL the Worker runs, against a migrated database", () => {
  let repo: Repo;
  let raw: DatabaseSync;

  beforeEach(() => {
    const d1 = migratedD1();
    repo = createRepo(d1.db);
    raw = d1.raw;
  });

  it("stores every field of a signup, and an unticked box as 0 rather than null", async () => {
    const stored = entry({
      updates_opt_in: 0,
      is_user: 0,
      is_creator: 1,
      is_professional: 1,
      is_student: 1,
      backs_nascent: 1,
      backs_larger: 1,
    });
    await repo.addToWaitlist(stored);
    expect(rowsOf(raw, "SELECT * FROM waitlist")).toEqual([
      { ...stored, id: 1, exported_at: null, unsubscribed_at: null },
    ]);
  });

  it("keeps the first row when the same address signs up again", async () => {
    await repo.addToWaitlist(entry());
    await repo.addToWaitlist(
      entry({
        name: "Asha Again",
        consent_at: 2000,
        source: "footer",
        amount: 500,
        months: "24",
        question: "",
        updates_opt_in: 0,
        is_user: 0,
        is_creator: 1,
        is_professional: 1,
        is_student: 1,
        created_at: 2000,
        updated_at: 2000,
      }),
    );
    expect(rowsOf(raw, "SELECT * FROM waitlist")).toEqual([
      { ...entry(), id: 1, exported_at: null, unsubscribed_at: null },
    ]);
  });

  it("writes an empty optional answer as an empty string, not as the word undefined", async () => {
    await repo.addToWaitlist(entry({ months: "", question: "" }));
    expect(rowsOf(raw, "SELECT months, question FROM waitlist")).toEqual([
      { months: "", question: "" },
    ]);
  });

  it("refuses an address that was not normalised before it reached the database", async () => {
    await expect(repo.addToWaitlist(entry({ email: "Asha@Example.com" }))).rejects.toThrow(
      /CHECK constraint failed/,
    );
  });
});

describe("the export SQL that scripts/list-export.mts itself runs, against a migrated database", () => {
  let repo: Repo;
  let raw: DatabaseSync;

  beforeEach(() => {
    const d1 = migratedD1();
    repo = createRepo(d1.db);
    raw = d1.raw;
  });

  it("hands each pending row to the exporter exactly once", async () => {
    await repo.addToWaitlist(entry());
    await repo.addToWaitlist(entry({ email: "b@example.com" }));

    expect(pending(raw).map((r) => r.email)).toEqual(["asha@example.com", "b@example.com"]);
    const first = claim(raw, 5000).map((r) => r.email);
    expect(first.sort()).toEqual(["asha@example.com", "b@example.com"]);
    expect(claim(raw, 9999)).toEqual([]);
    expect(pending(raw)).toEqual([]);
    expect(rowsOf(raw, "SELECT DISTINCT exported_at FROM waitlist")).toEqual([
      { exported_at: 5000 },
    ]);
  });

  it("withholds an unsubscribed row and reports whether the removal changed anything", async () => {
    await repo.addToWaitlist(entry());
    expect(markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 3000)).toBe(1);
    expect(markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 4000)).toBe(0);
    expect(pending(raw)).toEqual([]);
  });

  it("refuses to resurrect someone who unsubscribed, because anyone can post their address", async () => {
    await repo.addToWaitlist(entry());
    claim(raw, 5000);
    markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 6000);

    await repo.addToWaitlist(entry({ name: "Someone Else", consent_at: 7000, updated_at: 7000 }));

    expect(
      rowsOf(raw, "SELECT name, exported_at, unsubscribed_at, consent_at FROM waitlist"),
    ).toEqual([{ name: "Asha", exported_at: 5000, unsubscribed_at: 6000, consent_at: 1000 }]);
    expect(pending(raw)).toEqual([]);
  });

  it("hands the exporter only what the mailing list needs, and no answer, role or reason", async () => {
    await repo.addToWaitlist(entry());
    const keys = ["consent_at", "created_at", "email", "id", "name", "source", "updates_opt_in"];
    expect(pending(raw).map((row) => Object.keys(row).sort())).toEqual([keys]);
    expect(claim(raw, 5000).map((row) => Object.keys(row).sort())).toEqual([keys]);
  });

  it("takes one batch at a time, and reports what is still pending after it", async () => {
    for (let i = 0; i < BATCH + 20; i += 1) {
      await repo.addToWaitlist(entry({ email: `p${String(i).padStart(4, "0")}@example.com` }));
    }

    expect(pending(raw)).toHaveLength(BATCH);
    expect(claim(raw, 9000)).toHaveLength(BATCH);
    expect(rowsOf(raw, COUNT_PENDING)).toEqual([{ n: 20 }]);
    expect(claim(raw, 9001)).toHaveLength(20);
    expect(rowsOf(raw, COUNT_PENDING)).toEqual([{ n: 0 }]);
  });

  it("refuses an export time that is not a positive whole number", () => {
    expect(() => claimPending(Number.NaN)).toThrow(RangeError);
    expect(() => claimPending(0)).toThrow(RangeError);
  });
});
