import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync("wrangler.jsonc", "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1"),
) as Record<string, unknown>;

describe("the cms Worker config", () => {
  it("publishes on no workers.dev host", () => {
    expect(config.workers_dev).toBe(false);
  });

  it("publishes on no preview URL", () => {
    expect(config.preview_urls).toBe(false);
  });

  it("declares one environment", () => {
    expect(config.env).toBeUndefined();
  });

  it("answers on the cms host alone", () => {
    expect(config.routes).toEqual([{ pattern: "cms.rupeefund.org", custom_domain: true }]);
  });

  it("names its own content database, apart from the waitlist", () => {
    expect(config.d1_databases).toEqual([
      expect.objectContaining({ binding: "DB", database_name: "rupeefund-content" }),
    ]);
  });

  it("keeps media in its own bucket", () => {
    expect(config.r2_buckets).toEqual([{ binding: "MEDIA", bucket_name: "rupeefund-media" }]);
  });

  it("loads no sandboxed plugin, because Worker Loader needs the Paid plan", () => {
    expect(config.worker_loaders).toBeUndefined();
  });

  it("signs people in with passkeys, so it needs no Access audience", () => {
    expect(config.secrets).toEqual({ required: ["DEPLOY_HOOK_URL"] });
    expect(readFileSync("astro.config.mjs", "utf8")).not.toContain("access(");
  });

  it("holds no secret in plain vars", () => {
    const vars = (config.vars ?? {}) as Record<string, unknown>;
    expect(Object.keys(vars)).not.toContain("EMDASH_ENCRYPTION_KEY");
    expect(Object.keys(vars)).not.toContain("DEPLOY_HOOK_URL");
  });
});
