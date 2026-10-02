import type { D1Database, Fetcher, RateLimit } from "@cloudflare/workers-types";
import type { WaitlistRow } from "@rupeefund/db/schema";
import type { WaitlistInput } from "./lib/validation.ts";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SIGNUP_LIMITER?: RateLimit;
  TURNSTILE_SECRET?: string;
  TURNSTILE_HOSTNAMES?: string;
  TURNSTILE_ACTION?: string;
}

export type WaitlistEntry = WaitlistInput &
  Pick<WaitlistRow, "consent_at" | "created_at" | "updated_at">;

export interface Repo {
  addToWaitlist(entry: WaitlistEntry): Promise<void>;
}
