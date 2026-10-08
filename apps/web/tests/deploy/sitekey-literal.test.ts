import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEST_SITEKEY } from "./helpers.ts";

const CARRIERS = [
  "src/lib/turnstile.ts",
  "scripts/turnstile-dummy-keys.mjs",
  "tests/site/build.setup.ts",
] as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("the test sitekey literal", () => {
  for (const path of CARRIERS) {
    it(`is spelled the same in ${path}`, () => {
      expect(read(path)).toContain(`"${TEST_SITEKEY}"`);
    });
  }
});

describe("every build path that uses the test sitekey opts in explicitly", () => {
  const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;

  for (const [name, body] of Object.entries(scripts)) {
    if (!body.includes(TEST_SITEKEY)) continue;
    it(`pnpm ${name} sets PUBLIC_ALLOW_TEST_SITEKEY`, () => {
      expect(body).toContain("PUBLIC_ALLOW_TEST_SITEKEY=true");
    });
  }

  it("gives pnpm dev the same Turnstile test values as pnpm preview", () => {
    const values = [
      "PUBLIC_ALLOW_TEST_SITEKEY=true",
      `PUBLIC_TURNSTILE_SITEKEY=${TEST_SITEKEY}`,
      "TURNSTILE_SECRET=1x0000000000000000000000000000000AA",
    ];
    for (const value of values) {
      expect(scripts.preview).toContain(value);
      expect(scripts.dev).toContain(value);
    }
    expect(scripts.preview).toContain(
      "--var TURNSTILE_HOSTNAMES:example.com --var TURNSTILE_ACTION:",
    );
    expect(scripts.dev).toContain("TURNSTILE_HOSTNAMES=example.com TURNSTILE_ACTION= astro dev");
  });

  it("never lets CI reach for the test sitekey, so the deploy guard runs as it does in production", () => {
    expect(read("../../.github/workflows/ci.yml")).not.toContain(TEST_SITEKEY);
  });

  it("makes CI supply no sitekey at all, because the repository already carries it", () => {
    expect(read("../../.github/workflows/ci.yml")).not.toContain("PUBLIC_TURNSTILE_SITEKEY");
  });

  it("finds at least one such build path, so the suite cannot pass vacuously", () => {
    const paths = Object.values(scripts).filter((body) => body.includes(TEST_SITEKEY));
    expect(paths.length).toBeGreaterThan(0);
  });
});
