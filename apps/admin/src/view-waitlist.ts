import { page, REFRESH_CONTROLS } from "./chrome.ts";
import { NUMBERS } from "./section-numbers.ts";
import { QUESTIONS } from "./section-questions.ts";
import { RECORDS } from "./section-records.ts";

const SECTIONS = [NUMBERS, RECORDS, QUESTIONS];

const SCRIPT = `
async function readSummary() {
  const summary = await get("/api/summary", "no-cache");
  drawNumbers(summary);
  countRecords(summary);
  countQuestions(summary);
}

live(readSummary);
boot(() => Promise.all([readSummary(), loadRows(), loadQuestions()]));
`;

const HEAD = `<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
<h1 class="text-2xl" id="page-title">Waitlist</h1>
<div class="flex flex-wrap items-center gap-3 text-sm text-ink-2">${REFRESH_CONTROLS}</div>
</div>`;

export function waitlistPage(): string {
  return page({
    path: "/",
    body: [HEAD, ...SECTIONS.map((section) => section.body)].join("\n"),
    dialogs: SECTIONS.map((section) => section.dialogs ?? "").join(""),
    script: SECTIONS.map((section) => section.script).join("") + SCRIPT,
  });
}
