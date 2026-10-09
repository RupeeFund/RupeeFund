import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/,(\s*[}\]])/g, "$1")) as {
  triggers?: { crons?: string[] };
};

describe("the clean-up schedule", () => {
  it("runs once a day at minute 0, the only minute that EmDash cleans up in", () => {
    expect(config.triggers?.crons).toEqual(["0 0 * * *"]);
  });
});
