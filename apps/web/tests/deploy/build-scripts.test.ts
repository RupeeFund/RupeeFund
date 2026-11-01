import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<string, string>;
const builder = readFileSync("scripts/build.mjs", "utf8");

describe("one build chain serves the one environment", () => {
  it("routes the build through the guarded module, not astro on its own", () => {
    expect(scripts.build).toBe("node scripts/build.mjs");
  });

  it("builds the preview somewhere else, so dist can only come from the guarded chain", () => {
    expect(scripts.preview).toContain("--outDir dist-preview");
  });

  it("runs the config guard, the migration guard, the build and the sitekey guard in order", () => {
    const order = [
      "scripts/assert-deploy-env.mjs",
      "../../packages/db/scripts/assert-applied.mts",
      "astro",
      "scripts/assert-dist-sitekey.mjs",
    ];
    const positions = order.map((step) => builder.indexOf(step));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("stops the chain on the first failing step", () => {
    expect(builder).toContain("if (status !== 0) process.exit(status ?? 1)");
  });

  it("passes no target flag, because there is no second target", () => {
    expect(builder).not.toContain("--env");
  });
});

describe("the site suite reads the preview output, never the deployable one", () => {
  // `dist` exists on a developer machine that ran `pnpm run build`, and never on
  // a clean CI checkout. A site test that reads it passes locally and fails in
  // CI, which is exactly how this rule came to be written.
  const files = readdirSync("tests/site").filter((f) => f.endsWith(".ts"));

  it("finds the suite, so a broken scan cannot pass silently", () => {
    expect(files).toContain("meta.test.ts");
  });

  it("names no path under dist/, only the preview tree globalSetup builds", () => {
    for (const file of files) {
      const source = readFileSync(`tests/site/${file}`, "utf8");
      expect(source, `${file} reads dist/`).not.toMatch(/["'`]dist\//);
      expect(source, `${file} resolves against dist/`).not.toMatch(/resolve\(\s*["']dist["']/);
    }
  });
});
