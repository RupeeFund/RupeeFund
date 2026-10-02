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
    expect(scripts.preview).toContain("--assets dist-preview");
  });

  it("runs the config guard, the build and the sitekey guard in that order", () => {
    const order = ["scripts/assert-deploy-env.mjs", "astro", "scripts/assert-dist-sitekey.mjs"];
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

describe("each command has one owner, and check calls the owners", () => {
  const root = JSON.parse(readFileSync("../../package.json", "utf8")).scripts as Record<
    string,
    string
  >;

  it("delegates typecheck and test to the apps, and lint to the root script", () => {
    expect(root.check).toContain("turbo run typecheck test");
    expect(root.check).toContain("pnpm run lint");
  });

  it("restates no tool another script already owns", () => {
    for (const tool of ["tsc", "oxlint", "vitest", "wrangler"]) {
      expect(root.check, `check restates ${tool}`).not.toMatch(new RegExp(`(^|&&\\s*)${tool}\\b`));
    }
  });

  it("gives the site its own typecheck and test, so turbo has a step to run", () => {
    expect(scripts.typecheck).toContain("tsc");
    expect(scripts.test).toBe("vitest run");
  });

  it("stops at the first failing step, so a green line means every step ran", () => {
    expect(root.check).toContain("&&");
  });

  it("applies pending local migrations before each dev server starts", () => {
    for (const name of ["dev", "dev:admin", "dev:portless"]) {
      expect(root[name]).toMatch(/^pnpm db:migrate && /);
    }
  });

  it("makes db:reset the one command that erases, and it fills made-up rows", () => {
    expect(root["db:reset"]).toContain("run seed");
    expect(Object.keys(root)).not.toContain("bootstrap");
  });
});

describe("Workers Builds is the only path to the live site", () => {
  it("declares no deploy script, so the release path is not a local habit", () => {
    const deployScripts = Object.keys(scripts).filter((name) => /^deploy/.test(name));
    expect(deployScripts).toEqual([]);
  });

  it("ships no build script for a second environment", () => {
    const suffixed = Object.keys(scripts).filter((name) => /^build:/.test(name));
    expect(suffixed).toEqual([]);
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
