import type { D1Database } from "@cloudflare/workers-types";
import { claimPending, type ExportableRow } from "@rupeefund/db/export";
import type { ReasonField, RoleField, WaitlistRow } from "@rupeefund/db/schema";
import {
  AMOUNTS_SQL,
  DAILY_DAYS,
  DAILY_SQL,
  DAY_MS,
  PAGE_SQL,
  PAGE_SIZE,
  QUESTIONS_SQL,
  RATE_DAYS,
  REVEAL_SQL,
  TOTALS_SQL,
} from "./sql.ts";

export interface Totals extends Record<RoleField | ReasonField, number> {
  total: number;
  active: number;
  pending: number;
  recent_joined: number;
  recent_left: number;
  updates_opt_in: number;
  updates_asked: number;
  roles_answered: number;
  reasons_answered: number;
  questions: number;
}

export interface Tally {
  key: string;
  n: number;
}

export interface Pledges {
  count: number;
  sum: number;
  median: number | null;
}

export interface Summary {
  asOf: number;
  totals: Totals;
  pledges: Pledges;
  byDay: Tally[];
}

export type MaskedRow = Pick<
  WaitlistRow,
  | "id"
  | "name"
  | "source"
  | "amount"
  | "months"
  | "updates_opt_in"
  | RoleField
  | ReasonField
  | "consent_at"
  | "created_at"
  | "updated_at"
  | "exported_at"
  | "unsubscribed_at"
> & { email_masked: string; has_question: 0 | 1 };

export type QuestionRow = Pick<
  WaitlistRow,
  "id" | "name" | "created_at" | "exported_at" | "unsubscribed_at"
> & {
  email_masked: string;
  question: string;
};

export interface AdminRepo {
  summary(now: number): Promise<Summary>;
  page(before: number): Promise<MaskedRow[]>;
  questions(before: number): Promise<QuestionRow[]>;
  reveal(id: number): Promise<string | null>;
  claim(at: number): Promise<ExportableRow[]>;
}

interface AmountRow {
  amount: number;
  n: number;
}

interface DayRow {
  day: string;
  n: number;
}

function pledgesOf(rows: AmountRow[]): Pledges {
  let count = 0;
  let sum = 0;
  for (const row of rows) {
    count += row.n;
    sum += row.amount * row.n;
  }
  if (count === 0) return { count, sum, median: null };
  const low = nth(rows, Math.floor((count - 1) / 2));
  const high = nth(rows, Math.floor(count / 2));
  return { count, sum, median: (low + high) / 2 };
}

function nth(rows: AmountRow[], index: number): number {
  let seen = 0;
  for (const row of rows) {
    seen += row.n;
    if (index < seen) return row.amount;
  }
  throw new RangeError(`no amount at ${index} of ${seen}`);
}

export function createAdminRepo(db: D1Database): AdminRepo {
  return {
    async summary(now) {
      const [totals, amounts, daily] = await db.batch([
        db.prepare(TOTALS_SQL).bind(now - RATE_DAYS * DAY_MS),
        db.prepare(AMOUNTS_SQL),
        db.prepare(DAILY_SQL).bind(DAILY_DAYS),
      ]);

      const dayRows = daily.results as DayRow[];

      return {
        asOf: now,
        totals: (totals.results as Totals[])[0],
        pledges: pledgesOf(amounts.results as AmountRow[]),
        byDay: dayRows.map((row) => ({ key: row.day, n: row.n })).reverse(),
      };
    },

    async page(before) {
      const { results } = await db.prepare(PAGE_SQL).bind(before, PAGE_SIZE).all<MaskedRow>();
      return results;
    },

    async questions(before) {
      const { results } = await db
        .prepare(QUESTIONS_SQL)
        .bind(before, PAGE_SIZE)
        .all<QuestionRow>();
      return results;
    },

    async reveal(id) {
      const row = await db.prepare(REVEAL_SQL).bind(id).first<{ email: string }>();
      return row?.email ?? null;
    },

    async claim(at) {
      const { results } = await db.prepare(claimPending(at)).all<ExportableRow>();
      return results;
    },
  };
}
