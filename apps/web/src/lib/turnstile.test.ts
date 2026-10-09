import { afterEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_SITEKEY, getSitekey, resolveSitekey } from "./turnstile.ts";

describe("the sitekey lives in the repository, not in a dashboard field", () => {
  it("has the exact length of a sitekey, so a longer secret cannot pass for one", () => {
    expect(TURNSTILE_SITEKEY).toMatch(/^0x4[A-Za-z0-9_-]{21}$/);
    expect(TURNSTILE_SITEKEY).toHaveLength(24);
  });
});

describe("resolveSitekey", () => {
  it("falls back to the committed sitekey when nothing overrides it", () => {
    expect(resolveSitekey(undefined)).toBe(TURNSTILE_SITEKEY);
  });

  it("treats an empty override the same as an absent one", () => {
    expect(resolveSitekey("")).toBe(TURNSTILE_SITEKEY);
  });

  it("returns another real sitekey unchanged, so a rotation can be tried locally", () => {
    expect(resolveSitekey("0x4AAAAAAEnotTheRealOne")).toBe("0x4AAAAAAEnotTheRealOne");
  });
});

describe("getSitekey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers with the committed sitekey when the build sets no override", () => {
    vi.stubEnv("PUBLIC_TURNSTILE_SITEKEY", undefined);
    expect(getSitekey()).toBe(TURNSTILE_SITEKEY);
  });
});
