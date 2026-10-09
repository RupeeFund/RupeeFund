import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { sessionStore, type SqlDatabase } from "./session-store.ts";

function sqlite(): { db: SqlDatabase; raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  const statement = (sql: string, args: unknown[]) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    run: async () => void raw.prepare(sql).run(...(args as never[])),
    first: async <T>() => (raw.prepare(sql).get(...(args as never[])) as T | undefined) ?? null,
  });
  return { db: { prepare: (sql: string) => statement(sql, []) }, raw };
}

describe("sessionStore", () => {
  it("reads back what it wrote, and nothing for an unknown key", async () => {
    const { db } = sqlite();
    const store = sessionStore(() => db);
    await store.setItem("a", '{"user":1}');
    expect(await store.getItem("a")).toBe('{"user":1}');
    expect(await store.getItem("b")).toBeNull();
  });

  it("replaces a value on each write to the same key", async () => {
    const { db, raw } = sqlite();
    const store = sessionStore(() => db);
    await Promise.all([store.setItem("a", "1"), store.setItem("a", "2")]);
    await store.setItem("a", "3");
    expect(await store.getItem("a")).toBe("3");
    expect(raw.prepare("SELECT count(*) AS n FROM rupeefund_sessions").get()).toEqual({ n: 1 });
  });

  it("removes a key", async () => {
    const { db } = sqlite();
    const store = sessionStore(() => db);
    await store.setItem("a", "1");
    await store.removeItem("a");
    expect(await store.getItem("a")).toBeNull();
  });

  it("drops sessions untouched for a day when it starts", async () => {
    const { db, raw } = sqlite();
    await sessionStore(() => db).setItem("fresh", "1");
    raw.exec(
      "INSERT INTO rupeefund_sessions (key, value, updated_at) " +
        "VALUES ('old', '1', unixepoch() - 90000)",
    );
    const store = sessionStore(() => db);
    expect(await store.getItem("old")).toBeNull();
    expect(await store.getItem("fresh")).toBe("1");
  });
});
