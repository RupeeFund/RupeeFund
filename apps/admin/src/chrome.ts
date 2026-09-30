import { FAVICON, LOGO, STYLESHEET } from "../.generated/assets.ts";
import { icon, sprite } from "./icons.ts";
import { DAILY_DAYS } from "./sql.ts";

export interface NavEntry {
  href: string;
  label: string;
  count: boolean;
}

export const PAGES: readonly NavEntry[] = [
  { href: "/", label: "Overview", count: false },
  { href: "/records", label: "Records", count: true },
  { href: "/questions", label: "Questions", count: false },
];

export const PRELUDE = `
const DAY_MS = 86400000;
const WINDOW_DAYS = ${DAILY_DAYS};
const byId = (id) => document.getElementById(id);
const all = (selector) => document.querySelectorAll(selector);

async function get(path) {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(path + " answered " + res.status);
  return res.json();
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

function share(part, whole) {
  if (whole === 0) return "Nothing on the list yet";
  return Math.round((part / whole) * 100) + "% of the list";
}

function initials(name) {
  const words = String(name).trim().split(/\\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toUpperCase();
}

function person(row) {
  const copy = el("div", undefined, "person-copy");
  copy.append(el("span", row.name, "person-name"));
  copy.append(el("span", row.email_masked, "person-address"));
  const wrap = el("div", undefined, "person");
  wrap.append(el("span", initials(row.name), "initials"), copy);
  return wrap;
}

function day(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function longDay(ms) {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function keyDay(key) {
  return longDay(Date.parse(key + "T00:00:00Z"));
}

function money(amount) {
  if (!/^\\d+$/.test(amount)) return "₹" + amount;
  return "₹" + BigInt(amount).toLocaleString("en-IN");
}

function shortDay(key) {
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const parts = String(key).split("-");
  return Number(parts[2]) + " " + months[Number(parts[1]) - 1];
}

function state(row) {
  if (row.unsubscribed_at !== null) return "removed";
  if (row.exported_at !== null) return "exported";
  return "new";
}

function setNavCount(total) {
  for (const slot of all(".nav .count")) slot.textContent = String(total);
}

function fail(err) {
  byId("error-text").textContent =
    "Unable to reach the server. Check your connection, then try again.";
  byId("error").hidden = false;
  console.error(err);
}

function busy(on) {
  byId("main").setAttribute("aria-busy", String(on));
  byId("loading").hidden = !on;
}

let RUN = async () => {};

async function attempt() {
  const retry = byId("retry");
  if (retry.disabled) return;
  retry.disabled = true;
  byId("error").hidden = true;
  busy(true);
  try {
    await RUN();
  } catch (err) {
    fail(err);
  } finally {
    busy(false);
    retry.disabled = false;
  }
}

function boot(run) {
  RUN = run;
  byId("retry").addEventListener("click", () => {
    attempt();
  });
  attempt();
}
`;

function navLinks(path: string, extra: string): string {
  return PAGES.map((entry) => {
    const current = entry.href === path ? ' aria-current="page"' : "";
    const count = entry.count ? '<span class="count">—</span>' : "";
    return `<a class="nav-link${extra}" href="${entry.href}"${current}>${entry.label}${count}</a>`;
  }).join("");
}

function labelFor(path: string): string {
  return PAGES.find((entry) => entry.href === path)?.label ?? "Waitlist";
}

export interface ViewSlots {
  path: string;
  body: string;
  dialogs?: string;
  script: string;
}

export function page(view: ViewSlots): string {
  const label = labelFor(view.path);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${label} — The Rupee Fund</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="stylesheet" href="${STYLESHEET}">
</head>
<body class="min-h-dvh flex flex-col">
${sprite()}
<a class="skip" href="#main">Skip to the dashboard</a>
<header class="sticky top-0 z-50 border-b border-ink/10 bg-paper/85 backdrop-blur-md">
<div class="wrap py-3 flex items-center justify-between gap-6">
<a href="/" class="flex items-center min-h-11 rounded-sm">
<img src="${LOGO}" alt="The Rupee Fund" width="83" height="36" class="h-9 w-auto"></a>
<nav class="nav hidden md:flex gap-5 items-center min-h-12" aria-label="Sections">
${navLinks(view.path, "")}</nav>
<details class="group md:hidden" data-menu>
<summary class="list-none inline-flex items-center justify-center size-11 -mr-2 rounded-lg
  cursor-pointer [&::-webkit-details-marker]:hidden" aria-label="Sections">
<span class="group-open:hidden">${icon("menu")}</span>
<span class="hidden group-open:block">${icon("close")}</span></summary>
<nav class="nav wrap absolute inset-x-0 top-full flex flex-col items-start gap-1 border-b
  border-ink/10 bg-white py-3 shadow-card" aria-label="Sections">
${navLinks(view.path, " -mx-1")}</nav>
</details>
</div>
</header>
<main class="content wrap flex-1 grid content-start gap-8 py-10" id="main" tabindex="-1"
  aria-busy="true">
<div id="error" class="alert" role="alert" hidden>
<span id="error-text"></span>
<button class="btn btn-quiet btn-on-white" id="retry" type="button">Try again</button>
</div>
<p id="loading" class="text-sm text-ink-2" role="status">Loading the figures…</p>
${view.body}
</main>
<footer class="wrap py-8 flex flex-wrap justify-between gap-3 text-xs text-ink-2">
<span>Read from the live database. Every count holds for 60 seconds.</span>
<span>Signed in through Cloudflare Access.</span>
</footer>
${view.dialogs ?? ""}
<script>${PRELUDE}${view.script}</script>
</body>
</html>
`;
}
