import {
  REASON_FIELDS,
  type ReasonField,
  ROLE_FIELDS,
  type RoleField,
  type WaitlistRow,
} from "@rupeefund/db/schema";

const NAMES = [
  "Aarav Menon",
  "Bhavna Rao",
  "Chetan Iyer",
  "Divya Nair",
  "Farhan Qureshi",
  "Gita Sharma",
  "Harsh Patel",
  "Ishita Bose",
  "Jatin Kulkarni",
  "Kavya Reddy",
  "Lakshmi Pillai",
  "Manav Desai",
  "Nisha Varma",
  "Omkar Joshi",
  "Priya Chandran",
  "Rahul Saxena",
  "Sneha Gupta",
  "Tarun Bhat",
  "Uma Krishnan",
  "Vikram Shetty",
];

// The live list on 20 October 2026, so the local dashboard and home page show its figures.
// Each pair is days before now and signups that day; 64 of the 72 fall in the last 30 days.
const DAILY: readonly (readonly [number, number])[] = [
  [61, 1],
  [59, 1],
  [34, 1],
  [33, 4],
  [31, 1],
  [29, 8],
  [27, 3],
  [26, 2],
  [25, 4],
  [24, 5],
  [23, 10],
  [22, 10],
  [21, 4],
  [20, 1],
  [19, 2],
  [17, 1],
  [15, 1],
  [14, 3],
  [12, 7],
  [10, 1],
  [9, 2],
];
const DATES = DAILY.flatMap(([ago, n]) => Array.from({ length: n }, (_, j) => [ago, j] as const));
const ACTIVE = DATES.length;

// 70 amounts: ₹23,767 a month in total, with a median of ₹128.
const AMOUNTS = [
  ...Array<number>(20).fill(15),
  ...Array<number>(30).fill(128),
  ...Array<number>(15).fill(512),
  ...[1000, 1447, 2000, 2500, 5000],
];
const NO_AMOUNT = ACTIVE - AMOUNTS.length;
const WANT_UPDATES = 62;
const TICKED: Record<RoleField | ReasonField, number> = {
  is_user: 44,
  is_creator: 39,
  is_professional: 11,
  is_student: 15,
  backs_nascent: 11,
  backs_growing: 16,
  backs_larger: 12,
};

// Rows from before the form asked any question. They left the list, so no figure counts them.
const UNSUBSCRIBED = 3;

const MONTHS = ["", "", "3", "6", "12", "12", "24", "12+", "as long as it helps"];
const QUESTIONS = [
  "",
  "",
  "",
  "How is the money allocated?",
  "Can I give a one-off amount?",
  "Do you send a receipt for tax?",
  "Who audits the fund?",
];

const DAY = 86_400_000;
const HOUR = 3_600_000;

const COLUMNS = [
  "email",
  "name",
  "consent_at",
  "source",
  "amount",
  "months",
  "question",
  "updates_opt_in",
  ...ROLE_FIELDS,
  ...REASON_FIELDS,
  "exported_at",
  "unsubscribed_at",
  "created_at",
  "updated_at",
] as const satisfies readonly (keyof WaitlistRow)[];

type SeedRow = Pick<WaitlistRow, (typeof COLUMNS)[number]>;

function pick<T>(list: readonly T[], i: number, salt: number): T {
  const mixed = Math.imul(i + salt * 977, 2654435761) >>> 8;
  return list[mixed % list.length] as T;
}

// 37 is prime to 72, so each field ticks exactly `count` of the active rows.
function spread(i: number, count: number, salt: number): 0 | 1 {
  return (i * 37 + salt * 11) % ACTIVE < count ? 1 : 0;
}

function base(i: number, at: number): SeedRow {
  const name = pick(NAMES, i, 3);
  const none = Object.fromEntries([...ROLE_FIELDS, ...REASON_FIELDS].map((f) => [f, null]));
  return {
    email: `${name.toLowerCase().replaceAll(" ", ".")}.${i}@example.org`,
    name,
    consent_at: at,
    source: "subscribe",
    amount: null,
    months: null,
    question: null,
    updates_opt_in: null,
    ...(none as Pick<SeedRow, RoleField | ReasonField>),
    exported_at: null,
    unsubscribed_at: null,
    created_at: at,
    updated_at: at,
  };
}

function gone(i: number, now: number): SeedRow {
  const at = now - (70 - i) * DAY;
  return { ...base(i, at), unsubscribed_at: at + DAY };
}

function row(i: number, now: number): SeedRow {
  const [ago, j] = DATES[i] as readonly [number, number];
  const at = now - ago * DAY + j * HOUR;
  const asked = i >= NO_AMOUNT;
  const ticks = Object.entries(TICKED).map(([field, n], k) => [field, spread(i, n, k + 1)]);
  return {
    ...base(UNSUBSCRIBED + i, at),
    amount: asked ? (AMOUNTS[((i - NO_AMOUNT) * 29) % AMOUNTS.length] as number) : null,
    months: asked ? pick(MONTHS, i, 5) : null,
    question: asked ? pick(QUESTIONS, i, 4) : null,
    updates_opt_in: spread(i, WANT_UPDATES, 0),
    ...(Object.fromEntries(ticks) as Pick<SeedRow, RoleField | ReasonField>),
  };
}

function hostile(seed: SeedRow): SeedRow {
  return {
    ...seed,
    email: "<script>alert(1)</script>@example.org",
    name: 'Markup <img src=x onerror="alert(1)"> Tester',
    question: "Does the panel render this as text?",
  };
}

function literal(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

export function seedSql(now: number): string {
  const active = Array.from({ length: ACTIVE }, (_, i) => row(i, now));
  const rows = [
    ...Array.from({ length: UNSUBSCRIBED }, (_, i) => gone(i, now)),
    ...active.slice(0, -1),
    hostile(active[ACTIVE - 1] as SeedRow),
  ];
  const values = rows.map((r) => `(${COLUMNS.map((column) => literal(r[column])).join(", ")})`);
  const insert = `INSERT INTO waitlist\n  (${COLUMNS.join(", ")})\nVALUES\n${values.join(",\n")};`;
  return `DELETE FROM waitlist;\n${insert}\n`;
}
