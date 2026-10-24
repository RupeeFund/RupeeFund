import { afterEach, describe, expect, it, vi } from "vitest";
import { readSupporters, rupees, supportersOf } from "./supporters.ts";

const rows = (count: number, amount = 128) => [{ amount, n: count }];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("supportersOf", () => {
  it("hides the figures below 25 supporters", () => {
    expect(supportersOf(rows(24))).toBeNull();
  });

  it("gives the count, the season total and the median from 25 supporters", () => {
    expect(
      supportersOf([
        { amount: 15, n: 12 },
        { amount: 512, n: 13 },
      ]),
    ).toEqual({
      count: 25,
      season: (15 * 12 + 512 * 13) * 3,
      median: 512,
    });
  });

  it("counts each amount up to ₹10,000 a month", () => {
    expect(
      supportersOf([
        { amount: 15, n: 25 },
        { amount: 99_99_99_999, n: 1 },
      ])?.season,
    ).toBe((15 * 25 + 10_000) * 3);
  });

  it("rounds the median to a whole rupee", () => {
    expect(
      supportersOf([
        { amount: 15, n: 13 },
        { amount: 128, n: 13 },
      ])?.median,
    ).toBe(72);
  });
});

describe("readSupporters", () => {
  it("hides the figures and reports the failure when the list cannot be read", async () => {
    const db = {
      prepare: () => ({
        all: async () => {
          throw new Error("D1_ERROR: unavailable");
        },
      }),
    };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    let failed = 0;
    expect(await readSupporters(db as never, () => failed++)).toBeNull();
    expect(failed).toBe(1);
    expect(logged).toHaveBeenCalledWith("Unable to read the supporter figures", expect.any(Error));
  });

  it("reads the amounts of the list", async () => {
    const db = { prepare: () => ({ all: async () => ({ results: rows(30, 15) }) }) };
    let failed = 0;
    expect(await readSupporters(db as never, () => failed++)).toEqual({
      count: 30,
      season: 1350,
      median: 15,
    });
    expect(failed).toBe(0);
  });
});

describe("rupees", () => {
  it("groups the digits the Indian way", () => {
    expect(rupees(567890)).toBe("₹5,67,890");
  });
});
