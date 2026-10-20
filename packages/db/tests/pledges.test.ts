import { describe, expect, it } from "vitest";
import { pledgesOf } from "../src/pledges.ts";

describe("pledgesOf", () => {
  it("counts and sums the amounts of each group", () => {
    expect(
      pledgesOf([
        { amount: 15, n: 2 },
        { amount: 128, n: 1 },
      ]),
    ).toMatchObject({ count: 3, sum: 158 });
  });

  it("takes the middle amount of an odd count", () => {
    expect(
      pledgesOf([
        { amount: 15, n: 1 },
        { amount: 128, n: 2 },
      ]).median,
    ).toBe(128);
  });

  it("takes the mean of the two middle amounts of an even count", () => {
    expect(
      pledgesOf([
        { amount: 15, n: 1 },
        { amount: 128, n: 1 },
      ]).median,
    ).toBe(71.5);
  });

  it("has no median when nobody gave an amount", () => {
    expect(pledgesOf([])).toEqual({ count: 0, sum: 0, median: null });
  });
});
