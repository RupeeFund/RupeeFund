import { page } from "./chrome.ts";
import { icon } from "./icons.ts";
import { DAILY_DAYS } from "./sql.ts";

const KPIS = [
  { key: "total", glyph: "people", label: "On the waitlist" },
  { key: "active", glyph: "active", label: "Still active" },
  { key: "exported", glyph: "exported", label: "Exported" },
  { key: "updates_opt_in", glyph: "updates", label: "Want updates" },
] as const;

const COMMUNITY = [
  { key: "questions", label: "Asked a question" },
  { key: "foss_users", label: "FOSS users" },
  { key: "foss_contributors", label: "FOSS contributors" },
  { key: "students", label: "Students" },
] as const;

const SCRIPT = `
function everyDay(byDay) {
  const known = new Map();
  for (const point of byDay) known.set(point.key, point.n);
  const keys = [...known.keys()].sort();
  if (keys.length === 0) return [];
  const last = Date.parse(keys[keys.length - 1] + "T00:00:00Z");
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
  byId("chart-blank").hidden = series.length > 0;
  byId("plot").hidden = series.length === 0;
  if (series.length === 0) return;

  let peak = 1;
  for (const point of series) if (point.n > peak) peak = point.n;
  const top = Math.ceil(peak / 4) * 4;
  for (let i = 0; i <= 4; i += 1) ticks.append(el("span", String((top / 4) * i)));

  for (const point of series) {
    const bar = el("div", undefined, "bar");
    if (point.n === 0) bar.dataset.empty = "";
    bar.style.height = Math.max((point.n / top) * 100, 1.5) + "%";
    bar.title = point.n + " on " + keyDay(point.key);
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

let slices = { source: [], amount: [], months: [] };
let facet = "source";

function drawTallies() {
  const box = byId("tallies");
  const list = byId("breakdown-data");
  box.textContent = "";
  list.textContent = "";
  const rows = slices[facet];
  let whole = 0;
  for (const row of rows) whole += row.n;
  for (const row of rows) {
    const label = row.key === "" ? "not given" : facet === "amount" ? money(row.key) : row.key;
    const pct = whole === 0 ? 0 : Math.round((row.n / whole) * 100);
    const head = el("div", undefined, "tally-top");
    head.append(el("span", label), el("b", row.n + " · " + pct + "%"));
    const fill = el("i");
    fill.style.width = pct + "%";
    const track = el("div", undefined, "track");
    track.append(fill);
    const item = el("div");
    item.append(head, track);
    box.append(item);
    const pair = el("div");
    pair.append(el("dt", label), el("dd", String(row.n)));
    list.append(pair);
  }
  byId("breakdown-note").textContent =
    rows.length === 0 ? "Nothing recorded yet." : rows.length + " distinct values on the list.";
}

function kpi(key, value, caption) {
  byId("kpi-" + key).textContent = String(value);
  byId("kpi-" + key + "-caption").textContent = caption;
}

for (const button of all(".segments button")) {
  button.addEventListener("click", () => {
    facet = button.dataset.facet;
    for (const peer of all(".segments button")) {
      peer.setAttribute("aria-pressed", String(peer === button));
    }
    drawTallies();
  });
}

boot(async () => {
  const summary = await get("/api/summary");
  const totals = summary.totals;

  const started = totals.total === 0 ? "Nothing on the list yet" : "Across every signup source";
  kpi("total", totals.total, started);
  kpi("active", totals.active, share(totals.active, totals.total));
  kpi("exported", totals.exported, share(totals.exported, totals.total));
  kpi("updates_opt_in", totals.updates_opt_in, share(totals.updates_opt_in, totals.total));
  setNavCount(totals.total);

  for (const stat of all("[data-total]")) stat.textContent = String(totals[stat.dataset.total]);

  slices = { source: summary.bySource, amount: summary.byAmount, months: summary.byMonths };
  drawTallies();

  const series = everyDay(summary.byDay);
  drawChart(series);
  let charted = 0;
  for (const point of series) charted += point.n;
  byId("chart-total").textContent = String(charted);
  byId("chart-span").textContent = "signups over " + series.length + " days";
  byId("period").textContent =
    series.length === 0
      ? "no signups yet"
      : keyDay(series[0].key) + " – " + keyDay(series.at(-1).key);
});
`;

function kpiCards(): string {
  return KPIS.map((card) =>
    [
      '<article class="kpi card grid gap-3">',
      `<div class="flex items-center justify-between gap-3 text-ink-2">`,
      `<h3 class="eyebrow">${card.label}</h3>${icon(card.glyph)}</div>`,
      `<p class="kpi-value" id="kpi-${card.key}">—</p>`,
      `<p class="text-xs text-ink-2" id="kpi-${card.key}-caption"></p>`,
      "</article>",
    ].join(""),
  ).join("");
}

function communityStats(): string {
  return COMMUNITY.map((stat) =>
    [
      '<div class="grid gap-1">',
      `<strong class="kpi-value" id="community-${stat.key}" data-total="${stat.key}">—</strong>`,
      `<span class="text-xs text-ink-2">${stat.label}</span></div>`,
    ].join(""),
  ).join("");
}

const FIGURES = `<summary class="inline-flex items-center gap-2 min-h-11 cursor-pointer text-sm
  font-semibold rounded-sm">`;

const BODY = `<section class="flex flex-wrap items-end justify-between gap-6"
  aria-labelledby="page-title">
<div class="grid gap-3 max-w-[40rem]">
<p class="eyebrow text-brand-fg">Waitlist</p>
<h1 class="page-title" id="page-title">Waitlist overview</h1>
<p class="text-ink-2">Who joined, what they intend to contribute, and what they told us. Open
the records to read a single address.</p>
</div>
<p class="flex items-center gap-2 text-sm text-ink-2">${icon("signups")}
<span class="num" id="period">—</span></p>
</section>
<section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
${kpiCards()}</section>
<div class="grid gap-4 xl:grid-cols-2">
<section class="card grid gap-5 content-start" aria-labelledby="signups-title">
<div class="flex flex-wrap items-start justify-between gap-4">
<div><h2 class="text-xl" id="signups-title">Signup activity</h2>
<p class="text-xs text-ink-2">One bar for each day</p></div>
<p class="text-right"><strong class="kpi-value block" id="chart-total">—</strong>
<span class="text-xs text-ink-2" id="chart-span"></span></p>
</div>
<figure class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2" id="plot" hidden>
<div class="flex h-48 flex-col-reverse justify-between text-right text-xs text-ink-2 num"
  id="ticks"></div>
<div class="bars" id="bars" role="img" aria-labelledby="signups-title"
  aria-describedby="daily-data"></div>
<div class="col-start-2 flex justify-between text-xs text-ink-2 num" id="x-axis"></div>
</figure>
<div class="grid justify-items-center gap-3 py-8 text-center text-ink-2" id="chart-blank" hidden>
${icon("signups")}<p>Nobody has joined yet. The first signup draws the first bar.</p></div>
<p class="text-xs text-ink-2">The window ends at the newest signup and runs back
${DAILY_DAYS} days.</p>
<details>${FIGURES}View the daily figures${icon("chevron")}</summary>
<dl class="data-list" id="daily-data"></dl></details>
</section>
<section class="card grid gap-5 content-start" aria-labelledby="breakdown-title">
<div><h2 class="text-xl" id="breakdown-title">Waitlist breakdown</h2>
<p class="text-xs text-ink-2">Each slice covers the whole list</p></div>
<div class="segments flex flex-wrap gap-2" role="group" aria-label="Choose a breakdown">
<button class="btn btn-quiet btn-on-white btn-toggle" type="button" data-facet="source"
  aria-pressed="true">Source</button>
<button class="btn btn-quiet btn-on-white btn-toggle" type="button" data-facet="amount"
  aria-pressed="false">Intended amount</button>
<button class="btn btn-quiet btn-on-white btn-toggle" type="button" data-facet="months"
  aria-pressed="false">Months</button>
</div>
<div class="grid gap-4" id="tallies"></div>
<p class="text-xs text-ink-2" id="breakdown-note"></p>
<details>${FIGURES}View the figures${icon("chevron")}</summary>
<dl class="data-list" id="breakdown-data"></dl></details>
</section>
</div>
<section class="card grid gap-6 sm:grid-cols-2 xl:grid-cols-5" aria-labelledby="community-title">
<div class="grid gap-1 content-start sm:col-span-2 xl:col-span-1">
<h2 class="text-xl" id="community-title">The community</h2>
<p class="text-xs text-ink-2">A group can overlap another. A row from before we asked counts
in none.</p></div>
${communityStats()}
</section>`;

export function overviewPage(): string {
  return page({ path: "/", body: BODY, script: SCRIPT });
}
