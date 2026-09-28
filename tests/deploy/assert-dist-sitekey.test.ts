import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const GUARD = resolve("scripts/assert-dist-sitekey.mjs");
const TEST_SITEKEY = "1x00000000000000000000AA";
const DUMMY_SITEKEYS = [
  TEST_SITEKEY,
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
] as const;

interface Result {
  code: number;
  stderr: string;
}

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function runOn(files: Record<string, string>): Result {
  const dir = mkdtempSync(join(tmpdir(), "trf-dist-"));
  temporary.push(dir);
  mkdirSync(join(dir, "dist"), { recursive: true });
  for (const [file, body] of Object.entries(files)) {
    const target = join(dir, "dist", file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
  const out = spawnSync(process.execPath, [GUARD], { cwd: dir, encoding: "utf8" });
  return { code: out.status ?? -1, stderr: out.stderr };
}

describe("the dist guard refuses a build that cannot take signups", () => {
  it("passes a build that carries a real sitekey", () => {
    expect(
      runOn({ "subscribe.html": '<div data-sitekey="0x4AAAAAAFF1b4zzEwdZwWSX"></div>' }).code,
    ).toBe(0);
  });

  it("refuses the always-pass test sitekey and names the file that carries it", () => {
    const { code, stderr } = runOn({
      "index.html": "<p>nothing here</p>",
      "subscribe.html": `<div data-sitekey="${TEST_SITEKEY}"></div>`,
    });
    expect(code).toBe(1);
    expect(stderr).toContain("dist/subscribe.html");
  });

  it("finds the test sitekey in a bundled script, not only in the pages", () => {
    const { code, stderr } = runOn({
      "index.html": "<p>nothing here</p>",
      "_astro/island.abc123.js": `const k="${TEST_SITEKEY}";`,
    });
    expect(code).toBe(1);
    expect(stderr).toContain("dist/_astro/island.abc123.js");
  });

  it("refuses an empty dist, so a build that produced nothing cannot pass", () => {
    const { code, stderr } = runOn({});
    expect(code).toBe(1);
    expect(stderr).toContain("is empty");
  });

  for (const key of DUMMY_SITEKEYS) {
    it(`refuses the dummy sitekey ${key}, which the real secret also rejects`, () => {
      const { code, stderr } = runOn({ "subscribe.html": `<div data-sitekey="${key}"></div>` });
      expect(code).toBe(1);
      expect(stderr).toContain(key);
    });
  }
});
