import {
  AMOUNT_OPTIONS,
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

const AMOUNTS = [...AMOUNT_OPTIONS, ...AMOUNT_OPTIONS, 100, 250, 1000, 2500];
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
const TICKS = [0, 0, 1] as const;

const COUNT = 140;
const DAY = 86_400_000;
const SPAN = 90 * DAY;

const AMOUNT_ASKED = 8;
const UPDATES_ASKED = 20;
const ROLES_ASKED = 40;
const REST_ASKED = 80;
const ASKED_FROM_0005: readonly string[] = ["is_professional", ...REASON_FIELDS];

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

function tick(i: number, salt: number, field: string): 0 | 1 | null {
  if (i < ROLES_ASKED) return null;
  if (i < REST_ASKED && ASKED_FROM_0005.includes(field)) return null;
  return pick(TICKS, i, salt);
}

function row(i: number, now: number): SeedRow {
  const name = pick(NAMES, i, 3);
  const at = now - Math.ceil(((COUNT - i) * SPAN) / (COUNT + 1));
  const unsubscribed_at = i % 23 === 0 ? at + DAY : null;
  const asked = i >= AMOUNT_ASKED;
  const boxes = [...ROLE_FIELDS, ...REASON_FIELDS].map((field, n) => [
    field,
    tick(i, 6 + n, field),
  ]);
  return {
    email: `${name.toLowerCase().replaceAll(" ", ".")}.${i}@example.org`,
    name,
    consent_at: at,
    source: "subscribe",
    amount: asked ? pick(AMOUNTS, i, 2) : null,
    months: asked ? pick(MONTHS, i, 5) : null,
    question: asked ? pick(QUESTIONS, i, 4) : null,
    updates_opt_in: i < UPDATES_ASKED ? null : i % 3 === 0 ? 0 : 1,
    ...(Object.fromEntries(boxes) as Pick<SeedRow, RoleField | ReasonField>),
    exported_at: i % 5 === 0 && unsubscribed_at === null ? at + DAY * 2 : null,
    unsubscribed_at,
    created_at: at,
    updated_at: at,
  };
}

function hostile(now: number): SeedRow {
  return {
    ...row(COUNT - 1, now),
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
  const rows = [...Array.from({ length: COUNT }, (_, i) => row(i, now)), hostile(now)];
  const values = rows.map((r) => `(${COLUMNS.map((column) => literal(r[column])).join(", ")})`);
  const insert = `INSERT INTO waitlist\n  (${COLUMNS.join(", ")})\nVALUES\n${values.join(",\n")};`;
  return `DELETE FROM waitlist;\n${insert}\n`;
}
