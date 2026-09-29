import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TURNSTILE_SITEKEY,
  TURNSTILE_TEST_SITEKEY,
  getSitekey,
  resolveSitekey,
} from "./turnstile.ts";

describe("the sitekey lives in the repository, not in a dashboard field", () => {
  it("has the exact length of a sitekey, so a longer secret cannot pass for one", () => {
    expect(TURNSTILE_SITEKEY).toMatch(/^0x4[A-Za-z0-9_-]{21}$/);
    expect(TURNSTILE_SITEKEY).toHaveLength(24);
  });

  it("is not the always-pass test sitekey", () => {
    expect(TURNSTILE_SITEKEY).not.toBe(TURNSTILE_TEST_SITEKEY);
  });
});

describe("resolveSitekey", () => {
  it("falls back to the committed sitekey when nothing overrides it", () => {
    expect(resolveSitekey(undefined, false)).toBe(TURNSTILE_SITEKEY);
  });

  it("treats an empty override the same as an absent one", () => {
    expect(resolveSitekey("", false)).toBe(TURNSTILE_SITEKEY);
  });

  it("returns another real sitekey unchanged, so a rotation can be tried locally", () => {
    expect(resolveSitekey("0x4AAAAAAEnotTheRealOne", false)).toBe("0x4AAAAAAEnotTheRealOne");
  });

  it("refuses the test sitekey when nothing opted in, whatever script ran the build", () => {
    expect(() => resolveSitekey(TURNSTILE_TEST_SITEKEY, false)).toThrow(
      /PUBLIC_ALLOW_TEST_SITEKEY/,
    );
  });

  it("accepts the test sitekey only behind the explicit opt-in", () => {
    expect(resolveSitekey(TURNSTILE_TEST_SITEKEY, true)).toBe(TURNSTILE_TEST_SITEKEY);
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
