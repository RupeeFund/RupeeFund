import { REASON_FIELDS, ROLE_FIELDS, type WaitlistRow } from "@rupeefund/db/schema";

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
];
const AMOUNTS = [128, 15, 512, 128, 15, 128, 1000, 128, 15, 512, 250];
const MONTHS = ["", "6", "12", "as long as it helps"];
const QUESTIONS = ["", "", "", "How is the money allocated?", "Who audits the fund?"];

const ROWS = 84;
const UNSUBSCRIBED = 3;
const EXPORTED = 8;
const DAY = 86_400_000;
const HOUR = 3_600_000;

const BOXES = [...ROLE_FIELDS, ...REASON_FIELDS];
const COLUMNS = [
  "email",
  "name",
  "consent_at",
  "source",
  "amount",
  "months",
  "question",
  "updates_opt_in",
  ...BOXES,
  "exported_at",
  "unsubscribed_at",
  "created_at",
  "updated_at",
] as const satisfies readonly (keyof WaitlistRow)[];

type SeedRow = Pick<WaitlistRow, (typeof COLUMNS)[number]>;

function at<T>(list: readonly T[], i: number): T {
  return list[i % list.length] as T;
}

function row(i: number, now: number): SeedRow {
  const name = at(NAMES, i);
  const created = now - (ROWS - i) * DAY - HOUR;
  const boxes = BOXES.map((box, k) => [box, (i * (k + 3)) % 5 < 2 ? 1 : 0]);
  return {
    email: `${name.toLowerCase().replaceAll(" ", ".")}.${i}@example.org`,
    name,
    consent_at: created,
    source: "subscribe",
    amount: i % 7 === 0 ? null : at(AMOUNTS, i),
    months: at(MONTHS, i),
    question: at(QUESTIONS, i),
    updates_opt_in: i % 4 === 0 ? 0 : 1,
    ...(Object.fromEntries(boxes) as Pick<SeedRow, (typeof BOXES)[number]>),
    exported_at: i < EXPORTED ? created + HOUR : null,
    unsubscribed_at: i < UNSUBSCRIBED ? created + HOUR : null,
    created_at: created,
    updated_at: created,
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
  const rows = Array.from({ length: ROWS }, (_, i) => row(i, now));
  rows[ROWS - 1] = hostile(rows[ROWS - 1] as SeedRow);
  const values = rows.map((r) => `(${COLUMNS.map((column) => literal(r[column])).join(", ")})`);
  const insert = `INSERT INTO waitlist\n  (${COLUMNS.join(", ")})\nVALUES\n${values.join(",\n")};`;
  return `DELETE FROM waitlist;\n${insert}\n`;
}
