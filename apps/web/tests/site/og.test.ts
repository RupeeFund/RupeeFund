import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUT } from "./dist.ts";

describe("the site card", () => {
  const png = readFileSync(`${OUT}/og/site.png`);

  it("is a PNG", () => {
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it("is 1200 × 630, the size that link previews crop to", () => {
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
