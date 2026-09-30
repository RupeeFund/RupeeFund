import { beforeEach, describe, expect, it } from "vitest";
import { BATCH, COUNT_PENDING, SELECT_PENDING, stampExported } from "../scripts/list-export.mts";
import { createRepo } from "../src/worker/lib/db.ts";
import type { Repo, WaitlistEntry } from "../src/worker/types.ts";
import { migratedD1, rowsOf } from "@rupeefund/db/testing";
import type { DatabaseSync } from "node:sqlite";

function stampExportedAsTheExporterRunsIt(raw: DatabaseSync, ids: number[], at: number): number {
  const res = raw.prepare(stampExported(ids, at)).run();
  return Number(res.changes);
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
    amount: "100",
    months: "12",
    question: "Who audits this?",
    updates_opt_in: 1,
    is_foss_user: 1,
    is_foss_contributor: 0,
    is_student: 0,
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
      is_foss_user: 0,
      is_foss_contributor: 1,
      is_student: 1,
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
        amount: "500",
        months: "24",
        question: "",
        updates_opt_in: 0,
        is_foss_user: 0,
        is_foss_contributor: 1,
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

    const rows = pending(raw);
    expect(rows.map((r) => r.email)).toEqual(["asha@example.com", "b@example.com"]);

    expect(
      stampExportedAsTheExporterRunsIt(
        raw,
        rows.map((r) => r.id),
        5000,
      ),
    ).toBe(2);
    expect(pending(raw)).toEqual([]);
  });

  it("does not re-stamp a row that a previous run already exported", async () => {
    await repo.addToWaitlist(entry());
    const [row] = pending(raw);
    stampExportedAsTheExporterRunsIt(raw, [row!.id], 5000);
    expect(stampExportedAsTheExporterRunsIt(raw, [row!.id], 9999)).toBe(0);
    expect(rowsOf(raw, "SELECT exported_at FROM waitlist")).toEqual([{ exported_at: 5000 }]);
  });

  it("withholds an unsubscribed row and reports whether the removal changed anything", async () => {
    await repo.addToWaitlist(entry());
    expect(markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 3000)).toBe(1);
    expect(markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 4000)).toBe(0);
    expect(pending(raw)).toEqual([]);
  });

  it("refuses to resurrect someone who unsubscribed, because anyone can post their address", async () => {
    await repo.addToWaitlist(entry());
    const [row] = pending(raw);
    stampExportedAsTheExporterRunsIt(raw, [row!.id], 5000);
    markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 6000);

    await repo.addToWaitlist(entry({ name: "Someone Else", consent_at: 7000, updated_at: 7000 }));

    expect(
      rowsOf(raw, "SELECT name, exported_at, unsubscribed_at, consent_at FROM waitlist"),
    ).toEqual([{ name: "Asha", exported_at: 5000, unsubscribed_at: 6000, consent_at: 1000 }]);
    expect(pending(raw)).toEqual([]);
  });

  it("hands the mailing-list exporter no contribution answer, which it has no reason to hold", () => {
    for (const column of ["amount", "months", "question"]) {
      expect(SELECT_PENDING).not.toContain(column);
    }
  });

  it("hands the mailing-list exporter no audience role, because no send differs by role", () => {
    for (const column of ["is_foss_user", "is_foss_contributor", "is_student"]) {
      expect(SELECT_PENDING).not.toContain(column);
    }
  });

  it("takes one batch at a time, and reports what is still pending after it", async () => {
    for (let i = 0; i < BATCH + 20; i += 1) {
      await repo.addToWaitlist(entry({ email: `p${String(i).padStart(4, "0")}@example.com` }));
    }

    const first = pending(raw);
    expect(first).toHaveLength(BATCH);
    expect(
      stampExportedAsTheExporterRunsIt(
        raw,
        first.map((r) => r.id),
        9000,
      ),
    ).toBe(BATCH);
    expect(rowsOf(raw, COUNT_PENDING)).toEqual([{ n: 20 }]);

    const second = pending(raw);
    expect(second).toHaveLength(20);
    expect(
      stampExportedAsTheExporterRunsIt(
        raw,
        second.map((r) => r.id),
        9001,
      ),
    ).toBe(20);
    expect(rowsOf(raw, COUNT_PENDING)).toEqual([{ n: 0 }]);
  });
});
