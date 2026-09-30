export const TURNSTILE_TEST_SITEKEY = "1x00000000000000000000AA";

export const TURNSTILE_SITEKEY = "0x4AAAAAAFF1b4zzEwdZwWSX";

export const TURNSTILE_ACTION = "waitlist_signup";

export function resolveSitekey(override: string | undefined, allowTestKey: boolean): string {
  if (override === undefined || override.trim().length === 0) return TURNSTILE_SITEKEY;
  if (override === TURNSTILE_TEST_SITEKEY && !allowTestKey) {
    throw new Error(
      "PUBLIC_TURNSTILE_SITEKEY is Cloudflare's always-pass test sitekey. A deployed build that uses it rejects every signup, because the Worker verifies tokens with the real secret. Set PUBLIC_ALLOW_TEST_SITEKEY=true for a local preview or a CI build.",
    );
  }
  return override;
}

export function getSitekey(): string {
  return resolveSitekey(
    import.meta.env.PUBLIC_TURNSTILE_SITEKEY,
    import.meta.env.PUBLIC_ALLOW_TEST_SITEKEY === "true",
  );
}
