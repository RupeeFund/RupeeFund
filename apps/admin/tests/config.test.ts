import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync("wrangler.jsonc", "utf8").replace(/,(\s*[}\]])/g, "$1"),
) as Record<string, unknown>;

describe("the admin Worker config", () => {
  it("publishes on no workers.dev host", () => {
    expect(config.workers_dev).toBe(false);
  });

  it("publishes on no preview URL", () => {
    expect(config.preview_urls).toBe(false);
  });

  it("declares one environment", () => {
    expect(config.env).toBeUndefined();
  });

  it("binds no static assets, so no router strips ctx.access", () => {
    expect(config.assets).toBeUndefined();
  });

  it("owns no migrations directory, because it never writes", () => {
    const databases = config.d1_databases as Record<string, unknown>[];
    for (const database of databases) {
      expect(database.migrations_dir).toBeUndefined();
    }
  });

  it("reads the one production database the public Worker writes", () => {
    const root = JSON.parse(
      readFileSync("../web/wrangler.jsonc", "utf8").replace(/,(\s*[}\]])/g, "$1"),
    ) as Record<string, unknown>;
    const rootDatabases = root.d1_databases as Record<string, unknown>[];
    const adminDatabases = config.d1_databases as Record<string, unknown>[];
    expect(adminDatabases[0]?.database_id).toBe(rootDatabases[0]?.database_id);
  });

  it("answers on the admin host alone", () => {
    expect(config.routes).toEqual([{ pattern: "admin.rupeefund.org", custom_domain: true }]);
  });
});

const SRC = "src";

function shippedFiles(): string[] {
  return readdirSync(SRC).filter(
    (file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.startsWith("testkit"),
  );
}

describe("the admin Worker source", () => {
  it("imports no node builtin, because workerd has none", () => {
    for (const file of shippedFiles()) {
      expect(readFileSync(`${SRC}/${file}`, "utf8")).not.toContain("node:");
    }
  });

  it("ships more than only its test helpers", () => {
    expect(shippedFiles().length).toBeGreaterThan(0);
  });
});
