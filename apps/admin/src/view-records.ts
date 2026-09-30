import { page } from "./chrome.ts";
import { icon } from "./icons.ts";

const FIELDS = [
  { id: "source", label: "Source" },
  { id: "state", label: "Status" },
  { id: "amount", label: "Intended amount", num: true },
  { id: "months", label: "Term" },
  { id: "joined", label: "Joined", num: true },
  { id: "consent", label: "Consented", num: true },
  { id: "updates", label: "Wants updates" },
  { id: "question", label: "Asked a question" },
] as const;

const SCRIPT = `
const BADGES = { new: "dot", exported: "check", removed: "minus" };
const FILTERS = [
  { id: "search", key: "q" },
  { id: "filter-source", key: "source" },
  { id: "filter-status", key: "status" },
];

let loaded = [];
let cursor = null;
let total = null;

function matches(row) {
  const term = byId("search").value.trim().toLowerCase();
  const source = byId("filter-source").value;
  const status = byId("filter-status").value;
  if (source !== "" && row.source !== source) return false;
  if (status !== "" && state(row) !== status) return false;
  if (term === "") return true;
  const hay = row.name + " " + row.source + " " + row.email_masked;
  return hay.toLowerCase().indexOf(term) !== -1;
}

function openRecord(row) {
  byId("detail-name").textContent = row.name;
  byId("detail-address").textContent = row.email_masked;
  byId("detail-source").textContent = row.source;
  byId("detail-state").textContent = state(row);
  byId("detail-amount").textContent = row.amount === "" ? "not given" : money(row.amount);
  byId("detail-months").textContent = row.months === "" ? "not given" : row.months + " months";
  byId("detail-joined").textContent = longDay(row.created_at);
  byId("detail-consent").textContent = longDay(row.consent_at);
  byId("detail-updates").textContent = row.updates_opt_in === 1 ? "yes" : "no";
  byId("detail-question").textContent = row.has_question === 1 ? "yes" : "no";
  const button = byId("detail-reveal");
  button.setAttribute("aria-pressed", "false");
  button.disabled = false;
  button.dataset.id = String(row.id);
  button.dataset.masked = row.email_masked;
  byId("record-dialog").showModal();
}

function personCell(row) {
  const cell = el("td", undefined, "person-column");
  cell.setAttribute("data-label", "Person");
  cell.append(person(row));
  return cell;
}

function statusCell(row) {
  const mark = state(row);
  const badge = el("span", undefined, "badge");
  badge.dataset.state = mark;
  badge.append(use(BADGES[mark]), el("span", mark));
  const cell = el("td");
  cell.setAttribute("data-label", "Status");
  cell.append(badge);
  return cell;
}

function actionCell(row) {
  const open = el("button", undefined, "btn btn-quiet btn-on-white btn-icon");
  open.type = "button";
  open.setAttribute("aria-label", "Open the record for " + row.name);
  open.append(use("arrow"));
  open.addEventListener("click", () => openRecord(row));
  const cell = el("td", undefined, "row-action");
  cell.append(open);
  return cell;
}

function labelled(tag, text, className, label) {
  const cell = el(tag, text, className);
  cell.setAttribute("data-label", label);
  return cell;
}

function addRows(rows) {
  const body = byId("rows");
  for (const row of rows) {
    const pledge = labelled("td", undefined, undefined, "Intended amount");
    pledge.append(el("span", row.amount === "" ? "not given" : money(row.amount)));
    pledge.append(el("small", row.months === "" ? "no term given" : row.months + " months"));
    const tr = el("tr");
    tr.append(
      personCell(row),
      labelled("td", row.source, undefined, "Source"),
      pledge,
      labelled("td", longDay(row.created_at), "num", "Joined"),
      statusCell(row),
      actionCell(row),
    );
    body.append(tr);
  }
}

function countText(shown) {
  if (shown !== loaded.length) return shown + " of " + loaded.length + " loaded records match";
  if (total === null) return loaded.length + " loaded";
  return loaded.length + " of " + total + " loaded";
}

function applyFilters() {
  const body = byId("rows");
  let shown = 0;
  for (let i = 0; i < loaded.length; i += 1) {
    const tr = body.children[i];
    if (tr === undefined) continue;
    const keep = matches(loaded[i]);
    tr.hidden = !keep;
    if (keep) shown += 1;
  }
  byId("shown").textContent = countText(shown);
  byId("blank").hidden = shown > 0;
  byId("blank-copy").textContent =
    loaded.length === 0
      ? "Nobody has joined the waitlist yet. New signups appear here."
      : "No loaded record matches these filters. Clear them, or load more records.";
  rememberFilters();
}

function rememberFilters() {
  const params = new URLSearchParams();
  for (const filter of FILTERS) {
    const value = byId(filter.id).value.trim();
    if (value !== "") params.set(filter.key, value);
  }
  const query = params.toString();
  history.replaceState(null, "", query === "" ? location.pathname : "?" + query);
}

function restoreFilters() {
  const params = new URLSearchParams(location.search);
  for (const filter of FILTERS) {
    const value = params.get(filter.key);
    if (value !== null) byId(filter.id).value = value;
  }
}

function rememberSources() {
  const picker = byId("filter-source");
  const known = [];
  for (const row of loaded) if (known.indexOf(row.source) === -1) known.push(row.source);
  known.sort();
  const chosen = picker.value;
  picker.textContent = "";
  const any = el("option", "All sources");
  any.value = "";
  picker.append(any);
  for (const name of known) {
    const option = el("option", name);
    option.value = name;
    picker.append(option);
  }
  picker.value = known.indexOf(chosen) === -1 ? "" : chosen;
}

async function more() {
  const button = byId("more");
  if (button.disabled || button.hidden) return;
  button.disabled = true;
  try {
    const path = "/api/waitlist" + (cursor === null ? "" : "?before=" + cursor);
    const answer = await get(path);
    for (const row of answer.rows) loaded.push(row);
    addRows(answer.rows);
    cursor = answer.next;
    button.hidden = cursor === null;
    rememberSources();
    applyFilters();
  } finally {
    button.disabled = false;
  }
}

async function reveal() {
  const button = byId("detail-reveal");
  if (button.getAttribute("aria-pressed") === "true") {
    byId("detail-address").textContent = button.dataset.masked;
    button.setAttribute("aria-pressed", "false");
    return;
  }
  button.disabled = true;
  try {
    const one = await get("/api/reveal/" + button.dataset.id);
    byId("detail-address").textContent = one.email;
    button.setAttribute("aria-pressed", "true");
  } catch (err) {
    byId("record-dialog").close();
    fail(err);
  } finally {
    button.disabled = false;
  }
}

byId("more").addEventListener("click", () => {
  more().catch(fail);
});
byId("record-close").addEventListener("click", () => byId("record-dialog").close());
byId("detail-reveal").addEventListener("click", reveal);
byId("reset").addEventListener("click", () => {
  for (const filter of FILTERS) byId(filter.id).value = "";
  applyFilters();
});
for (const filter of FILTERS) byId(filter.id).addEventListener("input", applyFilters);
restoreFilters();

boot(async () => {
  try {
    const summary = await get("/api/summary");
    total = summary.totals.total;
    setNavCount(total);
    byId("records-total").textContent = total + " on the list";
  } catch (err) {
    console.error(err);
  }
  await more();
});
`;

function recordFields(): string {
  return FIELDS.map(
    (field) =>
      `<div><dt>${field.label}</dt>` +
      `<dd id="detail-${field.id}"${"num" in field ? ' class="num"' : ""}></dd></div>`,
  ).join("");
}

const DIALOG = `<dialog class="record-dialog" id="record-dialog" aria-labelledby="detail-name">
<div class="flex items-start justify-between gap-4 border-b border-ink/10 p-6">
<div class="grid gap-1 min-w-0"><p class="eyebrow text-brand-fg">Waitlist record</p>
<h2 class="text-xl [overflow-wrap:anywhere]" id="detail-name"></h2></div>
<button class="btn btn-quiet btn-on-white btn-icon" id="record-close" type="button"
  aria-label="Close the record">${icon("close")}</button>
</div>
<div class="grid gap-6 p-6">
<dl class="record-fields">
<div class="sm:col-span-2"><dt>Address</dt><dd class="flex flex-wrap items-center gap-3">
<span id="detail-address" class="num"></span>
<button class="btn btn-quiet btn-on-white btn-toggle" id="detail-reveal" type="button" autofocus
  aria-pressed="false">${icon("eye")}<span>Reveal</span></button>
</dd></div>
${recordFields()}
</dl>
<p class="border-t border-ink/10 pt-4 text-xs text-ink-2">The question text stays in the
database. A removal is permanent, and the exporter passes over a removed row.</p>
</div>
</dialog>`;

const BODY = `<section class="flex flex-wrap items-end justify-between gap-6"
  aria-labelledby="records-title">
<div class="grid gap-3 max-w-[40rem]">
<p class="eyebrow text-brand-fg">Waitlist</p>
<h1 class="page-title" id="records-title">Waitlist records</h1>
<p class="text-ink-2">Newest first. Open a record to reveal one address. Every reveal is
written to the log.</p>
</div>
<div class="grid gap-1 text-right text-sm text-ink-2 num">
<span id="records-total">—</span><span id="shown">—</span></div>
</section>
<section class="records card grid gap-6" aria-labelledby="records-title">
<div class="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
<div><label class="field-label" for="search">Find a loaded record</label>
<input class="field" id="search" type="search"
  placeholder="Name, source, or masked address"></div>
<div><label class="field-label" for="filter-source">Signup source</label>
<select class="field" id="filter-source"><option value="">All sources</option></select></div>
<div><label class="field-label" for="filter-status">Record status</label>
<select class="field" id="filter-status"><option value="">All statuses</option>
<option value="new">new</option><option value="exported">exported</option>
<option value="removed">removed</option></select></div>
<button class="btn btn-quiet btn-on-white" id="reset" type="button">Reset</button>
<p class="text-xs text-ink-2 sm:col-span-4 max-w-[40rem]">Filters run in your browser over
the records already loaded. Press <strong>Show 50 more</strong> to widen the set. The figures
on the overview always cover the whole list.</p>
</div>
<table class="records-table" aria-labelledby="records-title">
<thead><tr>
<th scope="col" class="w-[34%]">Person</th><th scope="col">Source</th>
<th scope="col">Intended amount</th><th scope="col">Joined</th><th scope="col">Status</th>
<th scope="col" class="w-16"><span class="sr-only">Open the record</span></th>
</tr></thead>
<tbody id="rows"></tbody>
</table>
<div class="grid justify-items-center gap-3 py-8 text-center text-ink-2" id="blank" hidden>
${icon("records")}<p class="max-w-[40ch]" id="blank-copy"></p></div>
<div class="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5
  text-xs text-ink-2">
<button class="btn btn-quiet btn-on-white" id="more" type="button">Show 50 more</button>
<span>The table carries no audience role. Read those on the overview.</span>
</div>
</section>`;

export function recordsPage(): string {
  return page({ path: "/records", body: BODY, dialogs: DIALOG, script: SCRIPT });
}
