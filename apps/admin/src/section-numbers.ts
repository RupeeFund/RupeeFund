import type { Section } from "./chrome.ts";
import { icon } from "./icons.ts";
import { RATE_DAYS } from "./sql.ts";

const GOAL = 1000;

const FIGURES = [
  { key: "active", label: "Signed up", note: true },
  { key: "rate", label: "Signups a day", note: true },
  { key: "goal", label: `${GOAL.toLocaleString("en-IN")} by`, note: true },
  { key: "monthly", label: "Pledged a month", note: true },
  { key: "median", label: "Median pledge", note: false },
  { key: "updates_opt_in", label: "Want updates", note: true },
  { key: "pending", label: "Waiting for export", note: false },
] as const;

const ROLES = [
  { key: "is_user", label: "Users or consumers" },
  { key: "is_creator", label: "Developers, implementers, creators or designers" },
  { key: "is_professional", label: "Professionals" },
  { key: "is_student", label: "Students" },
] as const;

const REASONS = [
  { key: "backs_nascent", label: "Fund nascent projects" },
  { key: "backs_growing", label: "Encourage small to mid-sized projects" },
  { key: "backs_larger", label: "Sustain larger projects" },
] as const;

const SCRIPT = `
const GOAL = ${GOAL};
const RATE_DAYS = ${RATE_DAYS};

function count(n) {
  return Number(n).toLocaleString("en-IN");
}

function goal(totals, asOf) {
  const growth = totals.recent_joined - totals.recent_left;
  if (totals.active >= GOAL) return ["Reached", ""];
  if (growth <= 0) return ["No estimate", "No growth in the last " + RATE_DAYS + " days"];
  const days = Math.ceil(((GOAL - totals.active) * RATE_DAYS) / growth);
  return [shortDate(asOf + days * DAY_MS), "At the current rate"];
}

function everyDay(byDay, asOf) {
  const known = new Map();
  for (const point of byDay) known.set(point.key, point.n);
  const keys = [...known.keys()].sort();
  if (keys.length === 0) return [];
  const today = Date.parse(day(asOf) + "T00:00:00Z");
  const last = Math.max(today, Date.parse(keys.at(-1) + "T00:00:00Z"));
  const floor = last - (WINDOW_DAYS - 1) * DAY_MS;
  const series = [];
  let at = Date.parse(keys[0] + "T00:00:00Z");
  if (at < floor) at = floor;
  for (; at <= last; at += DAY_MS) {
    const key = day(at);
    series.push({ key: key, n: known.get(key) ?? 0 });
  }
  return series;
}

function drawChart(series) {
  const bars = byId("bars");
  const ticks = byId("ticks");
  const axis = byId("x-axis");
  const list = byId("daily-data");
  for (const box of [bars, ticks, axis, list]) box.textContent = "";
  byId("chart-blank").hidden = series.length > 0;
  byId("plot").hidden = series.length === 0;
  if (series.length === 0) return;

  let peak = 1;
  for (const point of series) if (point.n > peak) peak = point.n;
  const top = Math.ceil(peak / 4) * 4;
  for (let i = 0; i <= 4; i += 2) ticks.append(el("span", String((top / 4) * i)));

  for (const point of series) {
    const bar = el("div", undefined, "bar");
    if (point.n === 0) bar.dataset.empty = "";
    bar.style.height = Math.max((point.n / top) * 100, 1.5) + "%";
    bar.title = plural(point.n, "signup", "signups") + " on " + keyDay(point.key);
    bars.append(bar);
    const pair = el("div");
    pair.append(el("dt", keyDay(point.key)), el("dd", String(point.n)));
    list.append(pair);
  }

  const edges = [0, Math.floor((series.length - 1) / 2), series.length - 1];
  const drawn = [];
  for (const index of edges) {
    if (drawn.indexOf(index) !== -1) continue;
    drawn.push(index);
    axis.append(el("span", shortDay(series[index].key)));
  }
}

function answered(n) {
  if (n === 0) return "Nobody answered yet.";
  return plural(n, "person", "people") + " answered. Each could pick more than one.";
}

function figure(key, value, note) {
  byId("figure-" + key).textContent = String(value);
  const slot = byId("figure-" + key + "-note");
  if (slot !== null) slot.textContent = note ?? "";
}

function drawNumbers(summary) {
  const totals = summary.totals;
  const pledges = summary.pledges;
  const left = totals.total - totals.active;
  const reached = Math.floor((totals.active * 100) / GOAL) + "% of " + count(GOAL);
  figure("active", count(totals.active), reached);
  const gone = left > 0 ? "the " + plural(left, "person", "people") : "people";
  byId("numbers-scope").textContent = "Every count leaves out " + gone + " who unsubscribed.";
  figure(
    "rate",
    (totals.recent_joined / RATE_DAYS).toLocaleString("en-IN", {
      maximumFractionDigits: 1,
      maximumSignificantDigits: 2,
      roundingPriority: "morePrecision",
    }),
    plural(totals.recent_joined, "signup", "signups") + " in the last " + RATE_DAYS + " days",
  );
  figure("goal", ...goal(totals, summary.asOf));
  figure(
    "monthly",
    money(pledges.sum),
    pledges.count === 0
      ? "No pledges yet"
      : "From " + plural(pledges.count, "person", "people"),
  );
  figure("median", pledges.median === null ? "None" : money(pledges.median));
  figure(
    "updates_opt_in",
    count(totals.updates_opt_in),
    share(totals.updates_opt_in, totals.updates_asked, "those asked"),
  );
  figure("pending", count(totals.pending));
  for (const slot of all("[data-count]")) slot.textContent = String(totals[slot.dataset.count]);
  byId("roles-base").textContent = answered(totals.roles_answered);
  byId("reasons-base").textContent = answered(totals.reasons_answered);

  const series = everyDay(summary.byDay, summary.asOf);
  drawChart(series);
  let charted = 0;
  for (const point of series) charted += point.n;
  byId("chart-total").textContent =
    charted === totals.active
      ? plural(charted, "signup", "signups")
      : count(charted) + " of " + plural(totals.active, "signup", "signups");
  byId("period").textContent =
    series.length === 0
      ? "No signups yet"
      : keyDay(series[0].key) + " – " + keyDay(series.at(-1).key);
}
`;

function figures(): string {
  return FIGURES.map((entry) =>
    [
      `<div><dt>${entry.label}</dt>`,
      `<dd class="figure" id="figure-${entry.key}">—</dd>`,
      entry.note ? `<dd class="figure-note" id="figure-${entry.key}-note"></dd>` : "",
      "</div>",
    ].join(""),
  ).join("");
}

type Entries = readonly { key: string; label: string }[];

function counts(entries: Entries): string {
  return entries
    .map((entry) => `<div><dt>${entry.label}</dt><dd data-count="${entry.key}">—</dd></div>`)
    .join("");
}

function group(id: string, title: string, entries: Entries): string {
  return [
    `<div><h3 class="eyebrow text-ink-2">${title}</h3>`,
    `<p class="mt-1 text-xs text-ink-2" id="${id}-base">—</p>`,
    `<dl class="counts">${counts(entries)}</dl></div>`,
  ].join("");
}

const FIGURES_DETAILS = `<summary class="inline-flex items-center gap-2 min-h-11 cursor-pointer
  text-xs font-semibold rounded-sm">View the daily figures
<span class="chevron">${icon("chevron")}</span></summary>`;

const BODY = `<section class="numbers card grid gap-6 sm:gap-8" aria-labelledby="numbers-title">
<div class="grid gap-1"><h2 class="text-lg" id="numbers-title">Numbers</h2>
<p class="text-xs text-ink-2 empty:hidden" id="numbers-scope"></p></div>
<dl class="figures">${figures()}</dl>
<div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
${group("roles", "Roles", ROLES)}
${group("reasons", "Reasons to join", REASONS)}
<div class="grid content-start gap-2 md:col-span-2 xl:col-span-1">
<div class="flex flex-wrap items-baseline justify-between gap-x-4">
<h3 class="eyebrow text-ink-2" id="signups-title">Signups by day</h3>
<p class="text-xs text-ink-2 num"><span id="chart-total">—</span> · <span id="period">—</span></p>
</div>
<figure class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1" id="plot" hidden>
<div class="flex h-24 flex-col-reverse justify-between text-right text-xs text-ink-2 num"
  id="ticks"></div>
<div class="bars" id="bars" role="img" aria-labelledby="signups-title"
  aria-describedby="daily-data"></div>
<div class="col-start-2 flex justify-between text-xs text-ink-2 num" id="x-axis"></div>
</figure>
<div class="grid justify-items-center gap-2 py-4 text-center text-sm text-ink-2" id="chart-blank"
  hidden>${icon("signups")}<p>Nobody has joined yet. The first signup draws the first bar.</p></div>
<details class="group">${FIGURES_DETAILS}<dl class="data-list" id="daily-data"></dl></details>
</div>
</div>
</section>`;

export const NUMBERS: Section = { body: BODY, script: SCRIPT };
