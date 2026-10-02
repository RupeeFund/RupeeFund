import { describe, expect, it } from "vitest";
import { parseD1Json } from "../scripts/list-export.mts";

describe("the wrangler --json envelope is unwrapped as wrangler actually emits it", () => {
  it("reads results out of the array wrangler returns", () => {
    const stdout = JSON.stringify([
      { results: [{ id: 13 }], success: true, meta: { duration: 0 } },
    ]);
    expect(parseD1Json(stdout)).toEqual([{ id: 13 }]);
  });

  it("tolerates a bare object instead of an array", () => {
    expect(parseD1Json(JSON.stringify({ results: [{ id: 1 }] }))).toEqual([{ id: 1 }]);
  });

  it("returns nothing rather than throwing when the envelope has no results", () => {
    expect(parseD1Json(JSON.stringify([{ success: true }]))).toEqual([]);
  });
});
