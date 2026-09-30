import type { D1Database, Fetcher, RateLimit } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SIGNUP_LIMITER?: RateLimit;
  TURNSTILE_SECRET?: string;
  TURNSTILE_HOSTNAMES?: string;
  TURNSTILE_ACTION?: string;
}

export interface WaitlistEntry {
  email: string;
  name: string;
  consent_at: number;
  source: string;
  amount: string;
  months: string;
  question: string;
  updates_opt_in: 0 | 1;
  is_foss_user: 0 | 1;
  is_foss_contributor: 0 | 1;
  is_student: 0 | 1;
  created_at: number;
  updated_at: number;
}

export interface WaitlistRow extends WaitlistEntry {
  id: number;
  exported_at: number | null;
  unsubscribed_at: number | null;
}

export interface Repo {
  addToWaitlist(entry: WaitlistEntry): Promise<void>;
}
