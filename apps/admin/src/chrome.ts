import { FAVICON, STYLESHEET } from "../.generated/assets.ts";
import { icon, sprite } from "./icons.ts";
import { PANEL_HEADER } from "./routes.ts";
import { DAILY_DAYS, DAY_MS } from "./sql.ts";

const PRELUDE = `
const DAY_MS = ${DAY_MS};
const WINDOW_DAYS = ${DAILY_DAYS};
const byId = (id) => document.getElementById(id);
const all = (selector) => document.querySelectorAll(selector);

async function get(path, cache = "default") {
  const headers = { accept: "application/json", "${PANEL_HEADER}": "1" };
  const res = await fetch(path, { cache, headers });
  if (!res.ok) {
    throw Object.assign(new Error(path + " answered " + res.status), { status: res.status });
  }
  return res.json();
}

function trouble(err) {
  const status = err instanceof Error ? err.status : undefined;
  if (status === 401 || status === 403) {
    return "Access refused. Reload the page to sign in again, then try again.";
  }
  if (status === 404) return "That record is no longer there. Reload the page.";
  if (typeof status === "number" && status >= 500) {
    return "The server could not load the data. Try again in a minute.";
  }
  if (typeof status === "number") {
    return "The server refused the request. Reload the page, then try again.";
  }
  return "The panel cannot reach the server. Check your connection, then try again.";
}

const RULES = new Intl.PluralRules("en-IN");

function plural(n, one, other) {
  return n + " " + (RULES.select(n) === "one" ? one : other);
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}

function use(name) {
  const ns = byId("sprite").namespaceURI;
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 24 24");
  const ref = document.createElementNS(ns, "use");
  ref.setAttribute("href", "#i-" + name);
  svg.append(ref);
  return svg;
}

function share(part, whole, of = "the list") {
  if (whole === 0) return "";
  return Math.round((part / whole) * 100) + "% of " + of;
}

function labelled(tag, text, className, label) {
  const cell = el(tag, text, className);
  cell.setAttribute("data-label", label);
  return cell;
}

function nameCell(row) {
  const cell = el("th", row.name, "person-name");
  cell.scope = "row";
  return cell;
}

function emailCell(row, live) {
  const text = el("span", row.email_masked, "email num");
  const eye = el("button", undefined, "btn btn-quiet btn-on-white btn-icon btn-toggle");
  eye.type = "button";
  eye.setAttribute("aria-pressed", "false");
  eye.setAttribute("aria-label", "Reveal the email of " + row.name);
  eye.append(use("eye"));
  eye.addEventListener("click", () => reveal(row, text, eye, live));
  const box = el("div", undefined, "email-box");
  box.append(eye, text);
  const cell = labelled("td", undefined, "email-cell", "Email");
  cell.append(box);
  return cell;
}

async function reveal(row, text, eye, live, shown = () => row) {
  const status = byId(live + "-status");
  const error = byId(live + "-error");
  if (eye.getAttribute("aria-pressed") === "true") {
    text.textContent = row.email_masked;
    eye.setAttribute("aria-pressed", "false");
    status.textContent = "Email hidden.";
    return;
  }
  if (eye.hasAttribute("aria-busy")) return;
  eye.setAttribute("aria-busy", "true");
  try {
    const one = await get("/api/reveal/" + row.id);
    if (shown() !== row) return;
    text.textContent = one.email;
    eye.setAttribute("aria-pressed", "true");
    error.hidden = true;
    status.textContent = "Email shown.";
  } catch (err) {
    console.error(err);
    if (shown() !== row) return;
    error.textContent = "The email did not load. " + trouble(err);
    error.hidden = false;
  } finally {
    if (shown() === row) eye.removeAttribute("aria-busy");
  }
}

function day(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function longDay(ms) {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function shortDate(ms) {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function keyDay(key) {
  return longDay(Date.parse(key + "T00:00:00Z"));
}

function money(amount) {
  return "₹" + Number(amount).toLocaleString("en-IN");
}

function answer(value, format) {
  if (value === null) return "Not recorded";
  if (value === "") return "Not given";
  return format === undefined ? String(value) : format(value);
}

function shortDay(key) {
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const parts = String(key).split("-");
  return Number(parts[2]) + " " + months[Number(parts[1]) - 1];
}

const STATES = { new: "New", exported: "Exported", unsubscribed: "Unsubscribed" };
const MARKS = { new: "dot", exported: "check", unsubscribed: "minus" };

function state(row) {
  if (row.unsubscribed_at !== null) return "unsubscribed";
  if (row.exported_at !== null) return "exported";
  return "new";
}

function statusCell(row) {
  const mark = state(row);
  const node = el("span", undefined, "status-mark");
  node.dataset.state = mark;
  node.append(use(MARKS[mark]), el("span", STATES[mark]));
  const cell = labelled("td", undefined, "status-cell", "Status");
  cell.append(node);
  return cell;
}

let RUN = async () => {};
let AGAIN = () => RUN();

function fail(err, again = () => RUN()) {
  AGAIN = again;
  byId("error-text").textContent = trouble(err);
  byId("error").hidden = false;
  console.error(err);
}

function busy(on) {
  byId("main").setAttribute("aria-busy", String(on));
  byId("loading").hidden = !on;
}

async function attempt() {
  const retry = byId("retry");
  if (retry.disabled) return;
  retry.disabled = true;
  if (document.activeElement === retry) byId("main").focus();
  byId("error").hidden = true;
  busy(true);
  let failure = null;
  try {
    await AGAIN();
  } catch (err) {
    failure = err;
  }
  busy(false);
  retry.disabled = false;
  if (failure !== null) fail(failure, AGAIN);
}

function startRefresh(refresh) {
  const button = byId("refresh");
  button.addEventListener("click", async () => {
    if (button.hasAttribute("data-busy")) return;
    button.setAttribute("data-busy", "");
    try {
      await refresh();
    } catch (err) {
      fail(err, refresh);
    }
    button.removeAttribute("data-busy");
  });
}

function boot(run, refresh) {
  RUN = run;
  startRefresh(refresh);
  byId("retry").addEventListener("click", () => {
    attempt();
  });
  attempt();
}
`;

export const REFRESH_CONTROL = `<button class="btn btn-quiet btn-on-white refresh" id="refresh"
  type="button">${icon("refresh")}Refresh</button>`;

export interface Section {
  body: string;
  dialogs?: string;
  script: string;
}

export interface ViewSlots {
  title: string;
  body: string;
  dialogs?: string;
  script: string;
}

export function page(view: ViewSlots): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${view.title} — The Rupee Fund</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="stylesheet" href="${STYLESHEET}">
</head>
<body class="shell">
${sprite()}
<a class="skip" href="#main">Skip to the content</a>
<header class="topbar">
<img class="topbar-mark" src="${FAVICON}" alt="The Rupee Fund" width="32" height="32">
<a class="btn btn-quiet btn-on-white topbar-signout"
  href="/cdn-cgi/access/logout">${icon("logout")}Sign out</a>
</header>
<p id="loading" class="sr-only" role="status">Loading…</p>
<main class="grid min-w-0 content-start gap-6 sm:gap-8 px-[clamp(1rem,3vw,2.5rem)] py-6"
  id="main" tabindex="-1" aria-busy="true">
<div id="error" class="alert" role="alert" hidden>
<span id="error-text"></span>
<button class="btn btn-quiet btn-on-white" id="retry" type="button">Try again</button>
</div>
${view.body}
</main>
${view.dialogs ?? ""}
<script>${PRELUDE}${view.script}</script>
</body>
</html>
`;
}
