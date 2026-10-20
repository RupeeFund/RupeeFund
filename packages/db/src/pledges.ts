export interface AmountRow {
  amount: number;
  n: number;
}

export interface Pledges {
  count: number;
  sum: number;
  median: number | null;
}

export const AMOUNTS_SQL = `SELECT
       amount,
       COUNT(*) AS n
     FROM waitlist
     WHERE unsubscribed_at IS NULL AND amount IS NOT NULL
     GROUP BY amount
     ORDER BY amount`;

export function pledgesOf(rows: AmountRow[]): Pledges {
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
