export const TURNSTILE_SITEKEY = "0x4AAAAAAFF1b4zzEwdZwWSX";

export const TURNSTILE_ACTION = "waitlist_signup";

export function resolveSitekey(override: string | undefined): string {
  if (override === undefined || override.trim().length === 0) return TURNSTILE_SITEKEY;
  return override;
}

export function getSitekey(): string {
  return resolveSitekey(import.meta.env.PUBLIC_TURNSTILE_SITEKEY);
}
