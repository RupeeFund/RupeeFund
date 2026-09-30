import type { D1Database } from "@cloudflare/workers-types";
import {
  DAILY_DAYS,
  DAILY_SQL,
  PAGE_SQL,
  PAGE_SIZE,
  QUESTIONS_SQL,
  REVEAL_SQL,
  SLICES_SQL,
  TOTALS_SQL,
} from "./sql.ts";

export interface Totals {
  total: number;
  active: number;
  exported: number;
  updates_opt_in: number;
  foss_users: number;
  foss_contributors: number;
  students: number;
  questions: number;
}

export interface Tally {
  key: string;
  n: number;
}

export interface Summary {
  totals: Totals;
  bySource: Tally[];
  byAmount: Tally[];
  byMonths: Tally[];
  byDay: Tally[];
}

export interface MaskedRow {
  id: number;
  email_masked: string;
  name: string;
  source: string;
  amount: string;
  months: string;
  updates_opt_in: number;
  consent_at: number;
  created_at: number;
  exported_at: number | null;
  unsubscribed_at: number | null;
  has_question: number;
}

export interface QuestionRow {
  id: number;
  email_masked: string;
  name: string;
  question: string;
  created_at: number;
  unsubscribed_at: number | null;
}

export interface AdminRepo {
  summary(): Promise<Summary>;
  page(before: number): Promise<MaskedRow[]>;
  questions(before: number): Promise<QuestionRow[]>;
  reveal(id: number): Promise<string | null>;
}

interface SliceRow {
  source: string;
  amount: string;
  months: string;
  n: number;
}

interface DayRow {
  day: string;
  n: number;
}

function tally(rows: SliceRow[], pick: (row: SliceRow) => string): Tally[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row);
    counts.set(key, (counts.get(key) ?? 0) + row.n);
  }
  return [...counts]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

export function createAdminRepo(db: D1Database): AdminRepo {
  return {
    async summary() {
      const [totals, slices, daily] = await db.batch([
        db.prepare(TOTALS_SQL),
        db.prepare(SLICES_SQL),
        db.prepare(DAILY_SQL).bind(DAILY_DAYS),
      ]);

      const sliceRows = slices.results as SliceRow[];
      const dayRows = daily.results as DayRow[];

      return {
        totals: (totals.results as Totals[])[0] ?? {
          total: 0,
          active: 0,
          exported: 0,
          updates_opt_in: 0,
          foss_users: 0,
          foss_contributors: 0,
          students: 0,
          questions: 0,
        },
        bySource: tally(sliceRows, (row) => row.source),
        byAmount: tally(sliceRows, (row) => row.amount),
        byMonths: tally(sliceRows, (row) => row.months),
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
  };
}
