export const WAITLIST_SOURCES = ["subscribe", "landing", "footer"] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

export const AMOUNT_OPTIONS = [15, 128, 512] as const;
export const AMOUNT_OTHER = "other";

export const ROLE_FIELDS = ["is_user", "is_creator", "is_professional", "is_student"] as const;
export type RoleField = (typeof ROLE_FIELDS)[number];

export const REASON_FIELDS = ["backs_nascent", "backs_growing", "backs_larger"] as const;
export type ReasonField = (typeof REASON_FIELDS)[number];

export interface WaitlistRow {
  id: number;
  email: string;
  name: string;
  consent_at: number;
  source: string;
  exported_at: number | null;
  unsubscribed_at: number | null;
  created_at: number;
  updated_at: number;
  amount: number | null;
  months: string | null;
  question: string | null;
  updates_opt_in: 0 | 1 | null;
  is_user: 0 | 1 | null;
  is_creator: 0 | 1 | null;
  is_professional: 0 | 1 | null;
  is_student: 0 | 1 | null;
  backs_nascent: 0 | 1 | null;
  backs_growing: 0 | 1 | null;
  backs_larger: 0 | 1 | null;
}
