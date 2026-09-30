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

const SOURCES = ["subscribe", "subscribe", "subscribe", "home", "footer"];
const AMOUNTS = ["100", "500", "500", "1000", "1000", "2500", "5000"];
const MONTHS = ["3", "6", "12", "12", "12", "24"];
const QUESTIONS = [
  "",
  "",
  "",
  "How is the money allocated?",
  "Can I give a one-off amount?",
  "Do you send a receipt for tax?",
  "Who audits the fund?",
];

const COUNT = 140;
const BEFORE_ROLES = 40;
const TICKS = [0, 0, 1];
const DAY = 86_400_000;
const START = Date.UTC(2026, 6, 1);

function pick(list, i, salt) {
  const mixed = Math.imul(i + salt * 977, 2654435761) >>> 8;
  return list[mixed % list.length];
}

function role(i, salt) {
  return i < BEFORE_ROLES ? "NULL" : pick(TICKS, i, salt);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const rows = [];
for (let i = 0; i < COUNT; i += 1) {
  const name = pick(NAMES, i, 3);
  const handle = name.toLowerCase().replaceAll(" ", ".");
  const email = `${handle}.${i}@example.org`;
  const at = START + Math.floor(i / 4) * DAY + (i % 4) * 3_600_000;
  const unsubscribed = i % 23 === 0 ? at + DAY : null;
  const exported = i % 5 === 0 && unsubscribed === null ? at + DAY * 2 : null;

  rows.push(
    `(${[
      quote(email),
      quote(name),
      at,
      quote(pick(SOURCES, i, 1)),
      quote(pick(AMOUNTS, i, 2)),
      quote(pick(MONTHS, i, 5)),
      quote(pick(QUESTIONS, i, 4)),
      i % 3 === 0 ? 0 : 1,
      role(i, 6),
      role(i, 7),
      role(i, 8),
      exported ?? "NULL",
      unsubscribed ?? "NULL",
      at,
      at,
    ].join(", ")})`,
  );
}

rows.push(
  `(${[
    quote("<script>alert(1)</script>@example.org"),
    quote('Markup <img src=x onerror="alert(1)"> Tester'),
    START,
    quote("subscribe"),
    quote("500"),
    quote("12"),
    quote("Does the panel render this as text?"),
    1,
    1,
    1,
    0,
    "NULL",
    "NULL",
    START,
    START,
  ].join(", ")})`,
);

const COLUMNS = `(email, name, consent_at, source, amount, months, question, updates_opt_in,
   is_foss_user, is_foss_contributor, is_student,
   exported_at, unsubscribed_at, created_at, updated_at)`;

process.stdout.write(
  `DELETE FROM waitlist;\nINSERT INTO waitlist\n  ${COLUMNS}\nVALUES\n${rows.join(",\n")};\n`,
);
