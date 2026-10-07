import { describe, expect, it } from "vitest";
import { appliedNames, unapplied } from "../src/applied.ts";

describe("the migration guard", () => {
  it("names each migration file that the live database has not applied", () => {
    const files = ["0001_init.sql", "0002_more.sql", "0003_new.sql"];
    expect(unapplied(files, ["0001_init.sql", "0002_more.sql"])).toEqual(["0003_new.sql"]);
  });

  it("passes when the live database applied every migration file", () => {
    expect(unapplied(["0001_init.sql"], ["0001_init.sql"])).toEqual([]);
  });

  it("reads only SQL files from the migrations folder", () => {
    expect(unapplied(["0001_init.sql", "README.md"], ["0001_init.sql"])).toEqual([]);
  });
});

describe("the applied migration names", () => {
  it("reads the names from the JSON that wrangler prints", () => {
    const stdout = JSON.stringify([{ results: [{ name: "0001_init.sql" }], success: true }]);
    expect(appliedNames(stdout)).toEqual(["0001_init.sql"]);
  });

  it("fails when wrangler prints no rows, so the guard cannot pass by accident", () => {
    expect(() => appliedNames(JSON.stringify([{ success: false }]))).toThrow(/no rows/);
  });
});
