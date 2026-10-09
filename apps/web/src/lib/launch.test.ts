import { describe, expect, it } from "vitest";
import { SEASONS } from "./launch.ts";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe("SEASONS", () => {
  it("split the year into four seasons of 3 months each", () => {
    expect(SEASONS.map((s) => [s.name, s.months, s.duration])).toEqual([
      ["Winter", "Dec – Feb", "3 months"],
      ["Summer", "Mar – May", "3 months"],
      ["Monsoon", "Jun – Aug", "3 months"],
      ["Post-monsoon", "Sep – Nov", "3 months"],
    ]);
  });

  it.each(SEASONS.map((s) => [s.name, s.accent]))(
    "gives %s an accent that holds white text at 4.5:1",
    (_, accent) => {
      expect(contrast("#ffffff", accent)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
