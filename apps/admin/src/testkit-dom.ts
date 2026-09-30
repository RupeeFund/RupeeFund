import { render } from "./pages.ts";

export const HOSTILE_NAME = '<img src=x onerror="globalThis.__pwned = true">';

export const SUMMARY = {
  totals: {
    total: 4,
    active: 3,
    exported: 1,
    updates_opt_in: 1,
    questions: 1,
    foss_users: 2,
    foss_contributors: 1,
    students: 0,
  },
  bySource: [
    { key: "subscribe", n: 3 },
    { key: "home", n: 1 },
  ],
  byAmount: [{ key: "500", n: 4 }],
  byMonths: [{ key: "", n: 4 }],
  byDay: [
    { key: "2026-01-01", n: 3 },
    { key: "2026-01-03", n: 1 },
  ],
};

export const ROW = {
  id: 7,
  email_masked: "s•••@example.org",
  name: HOSTILE_NAME,
  source: "subscribe",
  amount: "500",
  months: "",
  updates_opt_in: 1,
  consent_at: 1_700_000_000_000,
  created_at: 1_700_000_000_000,
  exported_at: null,
  unsubscribed_at: null,
  has_question: 1,
};

export const HOSTILE_QUESTION =
  'Can you help?\n<img src=x onerror="globalThis.__pwned = true"> — see http://evil.test/x';

export const QUESTION = {
  id: 9,
  email_masked: "a•••@example.org",
  name: HOSTILE_NAME,
  question: HOSTILE_QUESTION,
  created_at: 1_700_000_000_000,
  unsubscribed_at: null,
};

export const REVEALED = "someone@example.org";

export function parts(path: string): { body: string; code: string } {
  const html = render(path);
  const open = html.indexOf("<script>");
  return {
    body: html.slice(html.indexOf(">", html.indexOf("<body")) + 1, open),
    code: html.slice(open + "<script>".length, html.indexOf("</script>")),
  };
}

export function stubDialogs(): void {
  const proto = globalThis.HTMLDialogElement?.prototype;
  if (proto === undefined || typeof proto.showModal === "function") return;
  proto.showModal = function open(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function shut(this: HTMLDialogElement) {
    this.open = false;
  };
}

export function mount(path: string): void {
  const { body, code } = parts(path);
  document.body.innerHTML = body;
  new Function(code)();
}
