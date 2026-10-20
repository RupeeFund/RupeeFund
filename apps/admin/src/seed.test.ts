import { AMOUNTS_SQL, type AmountRow, pledgesOf } from "@rupeefund/db/pledges";
import { REASON_FIELDS, ROLE_FIELDS } from "@rupeefund/db/schema";
import { rowsOf } from "@rupeefund/db/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedSql } from "./seed.ts";
import { makeSqlite, type SqliteFixture } from "./testkit-sqlite.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 1, 12);

let fixture: SqliteFixture;

beforeEach(() => {
  fixture = makeSqlite();
  fixture.raw.exec(seedSql(NOW));
});

afterEach(() => {
  fixture.close();
});

function rows(sql: string): Record<string, unknown>[] {
  return rowsOf(fixture.raw, sql);
}

describe("the local seed", () => {
  it("loads into the migrated table, so every seed value passes its CHECK", () => {
    expect(rows("SELECT COUNT(*) AS n FROM waitlist")[0]?.n).toBe(75);
  });

  it("writes only the source the signup form sends", () => {
    expect(rows("SELECT DISTINCT source FROM waitlist")).toEqual([{ source: "subscribe" }]);
  });

  it("dates every row and every stamp in the 90 days up to the time it runs", () => {
    const [span] = rows(
      `SELECT MIN(created_at) AS first,
              MAX(MAX(created_at), MAX(updated_at), MAX(exported_at), MAX(unsubscribed_at)) AS last
       FROM waitlist`,
    );
    expect([Number(span?.first) >= NOW - 90 * DAY, Number(span?.last) <= NOW]).toEqual([
      true,
      true,
    ]);
  });

  it("leaves signups in the last 30 days, so the rate and the chart have data", () => {
    const [recent] = rows(
      `SELECT COUNT(*) AS n FROM waitlist WHERE created_at >= ${NOW - 30 * DAY}`,
    );
    expect(Number(recent?.n)).toBeGreaterThan(30);
  });

  it("gives the figures of the live list on 20 October 2026", () => {
    const active = (column: string) =>
      Number(rows(`SELECT SUM(${column}) AS n FROM waitlist WHERE unsubscribed_at IS NULL`)[0]?.n);
    const [counts] = rows(
      `SELECT COUNT(*) AS signups, COUNT(updates_opt_in) AS asked, COUNT(exported_at) AS exported,
              SUM(created_at >= ${NOW - 30 * DAY}) AS recent
       FROM waitlist WHERE unsubscribed_at IS NULL`,
    );
    expect({
      counts,
      pledges: pledgesOf(rows(AMOUNTS_SQL) as unknown as AmountRow[]),
      ticks: ["updates_opt_in", ...ROLE_FIELDS, ...REASON_FIELDS].map(active),
    }).toEqual({
      counts: { signups: 72, asked: 72, exported: 0, recent: 64 },
      pledges: { count: 70, sum: 23_767, median: 128 },
      ticks: [62, 44, 39, 11, 15, 11, 16, 12],
    });
  });

  it("keeps each question NULL on the seed rows from before the form asked it", () => {
    const columns = ["amount", "months", "updates_opt_in", ...ROLE_FIELDS, ...REASON_FIELDS];
    const misplaced = columns.filter((column) => {
      const [span] = rows(
        `SELECT MAX(CASE WHEN ${column} IS NULL THEN id END) AS last_unasked,
                MIN(CASE WHEN ${column} IS NOT NULL THEN id END) AS first_asked
         FROM waitlist`,
      );
      if (span === undefined || span.last_unasked === null) return true;
      return Number(span.last_unasked) > Number(span.first_asked);
    });
    expect(misplaced).toEqual([]);
  });
});
