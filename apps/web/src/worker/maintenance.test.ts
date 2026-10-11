import { describe, expect, it } from "vitest";
import { maintain } from "./maintenance.ts";

function recorder() {
  const lines: string[] = [];
  const write = (...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "));
  };
  return { lines, log: { log: write, warn: write, error: write } };
}

describe("the daily maintenance", () => {
  it("logs that the clean-up ran when the run starts at minute 0", async () => {
    const { lines, log } = recorder();
    await maintain(async () => {}, new Date("2026-10-11T00:00:05Z"), log);
    expect(lines).toEqual(["[scheduled] cleanup ran"]);
  });

  it("logs that the clean-up skipped when the run starts late", async () => {
    const { lines, log } = recorder();
    await maintain(async () => {}, new Date("2026-10-11T00:01:30Z"), log);
    expect(lines).toEqual([
      "[scheduled] cleanup skipped: the run started at 2026-10-11T00:01:30.000Z, not at minute 0",
    ]);
  });

  it("logs the failure and no clean-up line when the run fails", async () => {
    const { lines, log } = recorder();
    await maintain(
      async () => {
        throw new Error("D1 down");
      },
      new Date("2026-10-11T00:00:05Z"),
      log,
    );
    expect(lines).toEqual(["[scheduled] EmDash maintenance failed: Error: D1 down"]);
  });
});
