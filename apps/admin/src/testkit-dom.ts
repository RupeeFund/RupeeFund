import type { WaitlistRow } from "@rupeefund/db/schema";
import { render } from "./pages.ts";

export type RowFixture = Omit<WaitlistRow, "email" | "question"> & {
  email_masked: string;
  has_question: 0 | 1;
};

export const HOSTILE_NAME = '<img src=x onerror="globalThis.__pwned = true">';

export const SUMMARY = {
  asOf: Date.UTC(2026, 9, 1),
  totals: {
    total: 4,
    active: 3,
    pending: 2,
    recent_joined: 3,
    recent_left: 0,
    updates_opt_in: 1,
    updates_asked: 2,
    roles_answered: 2,
    reasons_answered: 2,
    questions: 1,
    is_user: 2,
    is_creator: 1,
    is_professional: 0,
    is_student: 0,
    backs_nascent: 1,
    backs_growing: 2,
    backs_larger: 0,
  },
  pledges: { count: 3, sum: 1140, median: 500 },
  byDay: [
    { key: "2026-09-29", n: 3 },
    { key: "2026-10-01", n: 1 },
  ],
};

export const ROW: RowFixture = {
  id: 7,
  email_masked: "••••@•••••.org",
  name: HOSTILE_NAME,
  source: "subscribe",
  amount: 500,
  months: "",
  updates_opt_in: 1,
  consent_at: 1_700_000_000_000,
  created_at: 1_700_000_000_000,
  exported_at: null,
  unsubscribed_at: null,
  updated_at: 1_700_000_000_000,
  is_user: 1,
  is_creator: 0,
  is_professional: null,
  is_student: 1,
  backs_nascent: 1,
  backs_growing: 0,
  backs_larger: 1,
  has_question: 1,
};

export const HOSTILE_QUESTION =
  'Can you help?\n<img src=x onerror="globalThis.__pwned = true"> — see http://evil.test/x';

export const QUESTION = {
  id: 9,
  email_masked: "••••@•••••.org",
  name: HOSTILE_NAME,
  question: HOSTILE_QUESTION,
  created_at: 1_700_000_000_000,
  exported_at: null,
  unsubscribed_at: null,
};

export const REVEALED = "someone@example.org";

export interface ViewData {
  summary: unknown;
  rows: unknown[];
  questions: unknown[];
}

export function viewData(): ViewData {
  return { summary: SUMMARY, rows: [ROW], questions: [QUESTION] };
}

export function answerFor(path: string, data: ViewData): unknown {
  if (path === "/api/summary") return data.summary;
  if (path.startsWith("/api/waitlist")) return { rows: data.rows, next: null };
  if (path.startsWith("/api/questions")) return { rows: data.questions, next: null };
  if (path.startsWith("/api/reveal/")) return { id: ROW.id, email: REVEALED };
  throw new Error(`unexpected path ${path}`);
}

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

const pending = new Set<ReturnType<typeof setTimeout>>();

function tracked<A extends unknown[]>(
  start: (...args: A) => ReturnType<typeof setTimeout>,
): (...args: A) => ReturnType<typeof setTimeout> {
  return (...args) => {
    const id = start(...args);
    pending.add(id);
    return id;
  };
}

export function mount(path: string): void {
  const { body, code } = parts(path);
  window.matchMedia ??= () => ({ matches: false }) as MediaQueryList;
  document.body.innerHTML = body;
  new Function("setTimeout", "setInterval", code)(
    tracked((...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args)),
    tracked((...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args)),
  );
}

export function unmount(): void {
  for (const id of pending) {
    clearTimeout(id);
    clearInterval(id);
  }
  pending.clear();
}
