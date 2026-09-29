import { describe, expect, it } from "vitest";
import { heroLockup, splitLetters } from "./lockup.ts";

const square = (x: number, size: number): string => `M${x} 0H${x + size}V${size}H${x}Z`;

describe("splitLetters", () => {
  it("returns one path per letter, left to right", () => {
    expect(splitLetters(square(50, 10) + square(0, 10))).toEqual([square(0, 10), square(50, 10)]);
  });

  it("keeps a counter inside the letter that surrounds it", () => {
    expect(splitLetters(square(2, 4) + square(0, 10))).toEqual([square(0, 10) + square(2, 4)]);
  });

  it("refuses a command whose x values it cannot read", () => {
    expect(() => splitLetters("M0 0l10 0Z")).toThrow("unsupported path command l");
    expect(() => splitLetters("M0 0A5 5 0 0 1 10 0Z")).toThrow("unsupported path command A");
  });
});

describe("heroLockup", () => {
  it("drops the title and puts each wordmark letter in order in one group", () => {
    const svg = `<svg><title>t</title><path id="wordmark" fill="#141414" d="${square(50, 10)}${square(0, 10)}"/></svg>`;

    expect(heroLockup(svg)).toBe(
      `<svg><g id="wordmark" fill="#141414"><path style="--i: 0" d="${square(0, 10)}"/><path style="--i: 1" d="${square(50, 10)}"/></g></svg>`,
    );
  });

  it("fails the build when the wordmark path is missing", () => {
    expect(() => heroLockup("<svg></svg>")).toThrow("logo.svg has no wordmark path");
  });
});
