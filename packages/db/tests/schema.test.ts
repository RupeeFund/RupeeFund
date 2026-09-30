import { describe, expect, it } from "vitest";
import type { WaitlistRow } from "../src/schema.ts";
import { migratedD1, rowsOf } from "../src/testing.ts";

type Column<T> = [
  NonNullable<T> extends number ? "INTEGER" : "TEXT",
  null extends T ? true : false,
];
type Columns = { [K in keyof WaitlistRow]-?: Column<WaitlistRow[K]> };

const COLUMNS: Columns = {
  id: ["INTEGER", false],
  email: ["TEXT", false],
  name: ["TEXT", false],
  consent_at: ["INTEGER", false],
  source: ["TEXT", false],
  exported_at: ["INTEGER", true],
  unsubscribed_at: ["INTEGER", true],
  created_at: ["INTEGER", false],
  updated_at: ["INTEGER", false],
  amount: ["INTEGER", true],
  months: ["TEXT", true],
  question: ["TEXT", true],
  updates_opt_in: ["INTEGER", true],
  is_user: ["INTEGER", true],
  is_creator: ["INTEGER", true],
  is_professional: ["INTEGER", true],
  is_student: ["INTEGER", true],
  backs_nascent: ["INTEGER", true],
  backs_growing: ["INTEGER", true],
  backs_larger: ["INTEGER", true],
};

describe("WaitlistRow", () => {
  it("matches the migrated table, column for column, with the same type and nullability", () => {
    const { raw } = migratedD1();
    const columns = rowsOf(raw, "PRAGMA table_info(waitlist)").map((c) => [
      c.name,
      [c.type, c.notnull === 0 && c.pk === 0],
    ]);
    expect(Object.fromEntries(columns)).toEqual(COLUMNS);
  });
});
