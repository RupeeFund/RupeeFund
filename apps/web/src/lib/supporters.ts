import { AMOUNTS_SQL, type AmountRow, MIN_SUPPORTERS, pledgesOf } from "@rupeefund/db/pledges";

const YEAR_MONTHS = 12;

// The form takes any "Other" amount, so one signup must not set the public total.
const MAX_PUBLIC_AMOUNT = 10_000;

export interface Supporters {
  count: number;
  year: number;
  median: number;
}

interface Waitlist {
  prepare(sql: string): { all<T>(): Promise<{ results: T[] }> };
}

export function supportersOf(rows: AmountRow[]): Supporters | null {
  const capped = rows.map(({ amount, n }) => ({ amount: Math.min(amount, MAX_PUBLIC_AMOUNT), n }));
  const { count, sum, median } = pledgesOf(capped);
  if (count < MIN_SUPPORTERS || median === null) return null;
  return { count, year: sum * YEAR_MONTHS, median: Math.round(median) };
}

export async function readSupporters(db: Waitlist, failed: () => void): Promise<Supporters | null> {
  try {
    const { results } = await db.prepare(AMOUNTS_SQL).all<AmountRow>();
    return supportersOf(results);
  } catch (error) {
    console.error("Unable to read the supporter figures", error);
    failed();
    return null;
  }
}

const GROUPED = new Intl.NumberFormat("en-IN");

export const grouped = (n: number): string => GROUPED.format(n);

export const rupees = (n: number): string => `₹${grouped(n)}`;
