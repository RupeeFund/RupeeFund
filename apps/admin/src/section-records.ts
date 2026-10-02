import type { Section } from "./chrome.ts";
import { icon } from "./icons.ts";
import { PANEL_HEADER } from "./routes.ts";

const FIELDS = [
  { id: "source", label: "Source" },
  { id: "state", label: "Status" },
  { id: "amount", label: "Monthly pledge", num: true },
  { id: "months", label: "Number of months" },
  { id: "joined", label: "Joined", num: true },
  { id: "consent", label: "Consented", num: true },
  { id: "updates", label: "Wants updates" },
  { id: "question", label: "Asked a question" },
  { id: "is_user", label: "User or consumer" },
  { id: "is_creator", label: "Developer, implementer, creator or designer" },
  { id: "is_professional", label: "Professional" },
  { id: "is_student", label: "Student" },
  { id: "backs_nascent", label: "Fund nascent projects" },
  { id: "backs_growing", label: "Encourage small to mid-sized projects" },
  { id: "backs_larger", label: "Sustain larger projects" },
  { id: "exported", label: "Exported", num: true },
  { id: "unsubscribed", label: "Unsubscribed", num: true },
  { id: "updated", label: "Last changed", num: true },
] as const;

const SCRIPT = `
const FILTERS = [
  { id: "search", key: "q" },
  { id: "filter-status", key: "status" },
];

const ROLES = {
  is_user: "User",
  is_creator: "Developer",
  is_professional: "Professional",
  is_student: "Student",
};
const REASONS = { backs_nascent: "Nascent", backs_growing: "Small to mid", backs_larger: "Larger" };

let loaded = [];
let cursor = null;
let total = null;
let pending = null;
let quiet = 0;
let rowsEpoch = 0;
let rowsRead = false;
let opened = null;

function yesNo(value) {
  return value === 1 ? "Yes" : "No";
}

function ticked(row, names) {
  const keys = Object.keys(names);
  if (keys.every((key) => row[key] === null)) return "Not recorded";
  const picked = keys.filter((key) => row[key] === 1).map((key) => names[key]);
  return picked.length === 0 ? "None" : picked.join(", ");
}

function dated(ms) {
  return ms === null ? "No" : longDay(ms);
}

function matches(row) {
  const term = byId("search").value.trim().toLowerCase();
  const status = byId("filter-status").value;
  if (status !== "" && state(row) !== status) return false;
  return term === "" || row.name.toLowerCase().indexOf(term) !== -1;
}

function openRecord(row) {
  opened = row;
  byId("detail-name").textContent = row.name;
  byId("detail-address").textContent = row.email_masked;
  byId("detail-source").textContent = row.source;
  byId("detail-state").textContent = STATES[state(row)];
  byId("detail-amount").textContent = answer(row.amount, money);
  byId("detail-months").textContent = answer(row.months);
  byId("detail-joined").textContent = longDay(row.created_at);
  byId("detail-consent").textContent = longDay(row.consent_at);
  byId("detail-updates").textContent = answer(row.updates_opt_in, yesNo);
  byId("detail-question").textContent = yesNo(row.has_question);
  for (const key of [...Object.keys(ROLES), ...Object.keys(REASONS)]) {
    byId("detail-" + key).textContent = answer(row[key], yesNo);
  }
  byId("detail-exported").textContent = dated(row.exported_at);
  byId("detail-unsubscribed").textContent = dated(row.unsubscribed_at);
  byId("detail-updated").textContent = longDay(row.updated_at);
  byId("detail-reveal").setAttribute("aria-pressed", "false");
  byId("detail-reveal").removeAttribute("aria-busy");
  byId("reveal-error").hidden = true;
  byId("reveal-status").textContent = "";
  byId("record-dialog").showModal();
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

function addRows(rows) {
  const body = byId("rows");
  const first = body.children.length;
  for (const row of rows) {
    const tr = el("tr");
    tr.append(
      nameCell(row),
      emailCell(row, "records-reveal"),
      labelled("td", answer(row.amount, money), "num amount", "Amount"),
      labelled("td", answer(row.months), undefined, "Months"),
      labelled("td", ticked(row, ROLES), undefined, "Roles"),
      labelled("td", ticked(row, REASONS), undefined, "Reasons"),
      labelled("td", answer(row.updates_opt_in, yesNo), undefined, "Updates"),
      labelled("td", shortDate(row.created_at), "num joined", "Joined"),
      statusCell(row),
      actionCell(row),
    );
    body.append(tr);
  }
  return first;
}

function countText(shown) {
  if (shown !== loaded.length) return "Matches: " + shown + " of " + loaded.length + " loaded";
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
  clearTimeout(quiet);
  quiet = setTimeout(() => {
    byId("match-status").textContent = countText(shown);
  }, 600);
  byId("records-blank").hidden = shown > 0 || !rowsRead;
  byId("records-blank-copy").textContent =
    loaded.length === 0
      ? "Nobody has joined the waitlist yet. New signups appear here."
      : "No loaded record matches these filters. Clear filters" +
        (cursor === null ? "." : ", or show 50 more.");
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

async function loadRows() {
  const mine = ++rowsEpoch;
  const page = await get("/api/waitlist");
  if (mine !== rowsEpoch) return;
  loaded = page.rows.slice();
  rowsRead = true;
  byId("rows").textContent = "";
  addRows(page.rows);
  cursor = page.next;
  byId("records-more").hidden = cursor === null;
  applyFilters();
}

async function moreRows() {
  const button = byId("records-more");
  if (button.disabled) return;
  button.disabled = true;
  const mine = rowsEpoch;
  try {
    const page = await get("/api/waitlist?before=" + cursor);
    if (mine !== rowsEpoch) return;
    for (const row of page.rows) loaded.push(row);
    const first = addRows(page.rows);
    cursor = page.next;
    const focused = document.activeElement === button;
    button.hidden = cursor === null;
    applyFilters();
    if (focused && button.hidden) landAfter(first);
  } finally {
    button.disabled = false;
  }
}

function landAfter(first) {
  const rows = [...byId("rows").children].slice(first).filter((tr) => !tr.hidden);
  if (rows.length === 0) byId("main").focus();
  else rows[0].querySelector(".row-action button").focus();
}

function exportCopy() {
  const confirm = byId("export-confirm");
  byId("export-error").hidden = true;
  if (pending === 0) {
    byId("export-copy").textContent = "No one is waiting for export.";
    confirm.hidden = true;
    return;
  }
  confirm.hidden = false;
  byId("export-copy").textContent =
    (pending === null ? "The number of people waiting is not available. " :
      plural(pending, "person waits", "people wait") + " for export. ") +
    "The export saves up to 500 of them to a CSV file and marks them as exported, " +
    "so the next export skips them. The file holds full addresses. Delete it after the import.";
}

async function runExport() {
  const confirm = byId("export-confirm");
  if (confirm.disabled) return;
  confirm.disabled = true;
  let res;
  try {
    res = await fetch("/api/export", { method: "POST", headers: { "${PANEL_HEADER}": "1" } });
    if (!res.ok) {
      throw Object.assign(new Error("/api/export answered " + res.status), { status: res.status });
    }
  } catch (err) {
    byId("export-error").textContent = "Nothing was exported. " + trouble(err);
    byId("export-error").hidden = false;
    console.error(err);
    confirm.disabled = false;
    return;
  }
  confirm.disabled = false;
  byId("export-dialog").close();
  try {
    byId("export-status").textContent = await save(res);
  } catch (err) {
    byId("export-status").textContent =
      "The people were marked as exported, but the file did not save. " +
      "Ask an operator to send batch " + res.headers.get("x-export-at") + " again.";
    console.error(err);
  }
  try {
    await Promise.all([readSummary(), loadRows(), loadQuestions()]);
  } catch (err) {
    fail(err);
  }
}

async function save(res) {
  if (res.status === 204) return "No one was waiting for export.";
  const text = await res.text();
  const link = el("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  link.download = "rupeefund-export-" + res.headers.get("x-export-at") + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  const count = Number(res.headers.get("x-export-count"));
  return "Exported " + plural(count, "person", "people") + ".";
}

function countRecords(summary) {
  total = summary.totals.total;
  pending = summary.totals.pending;
  applyFilters();
}

byId("export-open").addEventListener("click", async () => {
  try {
    await readSummary();
  } catch (err) {
    console.error(err);
  }
  exportCopy();
  byId("export-dialog").showModal();
});
byId("export-cancel").addEventListener("click", () => byId("export-dialog").close());
byId("export-confirm").addEventListener("click", runExport);
byId("records-more").addEventListener("click", () => {
  if (!byId("records-more").hidden) moreRows().catch((err) => fail(err, moreRows));
});
byId("record-close").addEventListener("click", () => byId("record-dialog").close());
byId("detail-reveal").addEventListener("click", () =>
  reveal(opened, byId("detail-address"), byId("detail-reveal"), "reveal", () => opened),
);
byId("reset").addEventListener("click", () => {
  for (const filter of FILTERS) byId(filter.id).value = "";
  applyFilters();
});
for (const filter of FILTERS) byId(filter.id).addEventListener("input", applyFilters);
restoreFilters();
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
<h2 class="text-xl min-w-0 [overflow-wrap:anywhere]" id="detail-name"></h2>
<button class="btn btn-quiet btn-on-white btn-icon" id="record-close" type="button" autofocus
  aria-label="Close the record">${icon("close")}</button>
</div>
<div class="record-body grid gap-6 p-6">
<dl class="record-fields">
<div class="sm:col-span-2"><dt>Email</dt><dd class="flex flex-wrap items-center gap-3">
<span id="detail-address" class="num"></span>
<button class="btn btn-quiet btn-on-white btn-toggle" id="detail-reveal" type="button"
  aria-pressed="false">${icon("eye")}<span>Reveal</span></button>
<span class="sr-only" id="reveal-status" role="status"></span>
<span class="basis-full text-xs text-error" id="reveal-error" role="alert" hidden></span>
</dd></div>
${recordFields()}
</dl>
<p class="border-t border-ink/10 pt-4 text-xs text-ink-2">Each reveal is logged.</p>
</div>
</dialog>`;

const EXPORT = `<dialog class="record-dialog" id="export-dialog" aria-labelledby="export-title"
  aria-describedby="export-copy">
<div class="grid gap-4 p-6">
<h2 class="text-xl" id="export-title">Export for the mailing list</h2>
<p class="text-pretty" id="export-copy"></p>
<p class="text-xs text-error" id="export-error" role="alert" hidden></p>
<div class="flex flex-wrap justify-end gap-3">
<button class="btn btn-quiet btn-on-white" id="export-cancel" type="button"
  autofocus>Cancel</button>
<button class="btn btn-primary" id="export-confirm" type="button">Export and save</button>
</div></div>
</dialog>`;

const BODY = `<section class="records card grid gap-6 sm:gap-8" aria-labelledby="records-title">
<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
<div class="grid gap-1"><h2 class="text-lg" id="records-title">Records</h2>
<p class="text-xs text-ink-2">Each email you reveal is logged.</p></div>
<div class="flex flex-wrap items-center gap-4 text-sm text-ink-2">
<span class="num" id="shown">—</span>
<span class="sr-only" id="match-status" role="status"></span>
<button class="btn btn-quiet btn-on-white" id="export-open" type="button">Export</button>
</div>
<p class="basis-full text-sm text-ink-2 empty:hidden" id="export-status" role="status"></p>
<p class="basis-full text-sm text-error" id="records-reveal-error" role="alert" hidden></p>
<span class="sr-only" id="records-reveal-status" role="status"></span>
</div>
<div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end lg:grid-cols-[2fr_1fr_auto]">
<div class="sm:col-span-2 lg:col-span-1">
<label class="field-label" for="search">Find a loaded record</label>
<input class="field" id="search" type="search" placeholder="Name"></div>
<div><label class="field-label" for="filter-status">Status</label>
<span class="select"><select class="field" id="filter-status">
<option value="">All statuses</option>
<option value="new">New</option><option value="exported">Exported</option>
<option value="unsubscribed">Unsubscribed</option></select>${icon("chevron")}</span></div>
<button class="btn btn-quiet btn-on-white" id="reset" type="button">Clear filters</button>
</div>
<table class="data-table records-table" aria-labelledby="records-title">
<thead><tr>
<th scope="col">Name</th><th scope="col" class="w-52">Email</th>
<th scope="col" class="amount w-24">Amount</th><th scope="col" class="w-28">Months</th>
<th scope="col">Roles</th><th scope="col">Reasons</th>
<th scope="col" class="w-24">Updates</th><th scope="col" class="w-28">Joined</th>
<th scope="col" class="w-36">Status</th>
<th scope="col" class="w-14"><span class="sr-only">Open the record</span></th>
</tr></thead>
<tbody id="rows"></tbody>
</table>
<div class="grid justify-items-center gap-3 py-8 text-center text-ink-2" id="records-blank"
  hidden>${icon("records")}<p class="max-w-[40ch]" id="records-blank-copy"></p></div>
<button class="btn btn-quiet btn-on-white justify-self-start" id="records-more" type="button"
  hidden>Show 50 more</button>
</section>`;

export const RECORDS: Section = { body: BODY, dialogs: DIALOG + EXPORT, script: SCRIPT };
