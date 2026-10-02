import type { Section } from "./chrome.ts";
import { icon } from "./icons.ts";

const SCRIPT = `
let askedCursor = null;
let askedEpoch = 0;

function questionRow(row) {
  const who = nameCell(row);
  who.tabIndex = -1;
  const tr = el("tr");
  tr.append(
    who,
    emailCell(row, "questions-reveal"),
    labelled("td", shortDate(row.created_at), "num", "Asked on"),
    statusCell(row),
    labelled("td", row.question, "question-body", "Question"),
  );
  return tr;
}

function showQuestions(rows) {
  const body = byId("questions-rows");
  const first = body.children.length;
  for (const row of rows) body.append(questionRow(row));
  byId("questions-blank").hidden = body.children.length > 0;
  return first;
}

async function loadQuestions() {
  const mine = ++askedEpoch;
  const page = await get("/api/questions");
  if (mine !== askedEpoch) return;
  byId("questions-rows").textContent = "";
  showQuestions(page.rows);
  askedCursor = page.next;
  byId("questions-more").hidden = askedCursor === null;
}

async function moreQuestions() {
  const button = byId("questions-more");
  if (button.disabled) return;
  button.disabled = true;
  const mine = askedEpoch;
  try {
    const page = await get("/api/questions?before=" + askedCursor);
    if (mine !== askedEpoch) return;
    const first = showQuestions(page.rows);
    askedCursor = page.next;
    const focused = document.activeElement === button;
    button.hidden = askedCursor === null;
    if (focused && button.hidden) {
      (byId("questions-rows").children[first]?.querySelector("th") ?? byId("main")).focus();
    }
  } finally {
    button.disabled = false;
  }
}

function countQuestions(summary) {
  byId("questions-total").textContent = summary.totals.questions + " asked";
}

byId("questions-more").addEventListener("click", () => {
  if (!byId("questions-more").hidden) moreQuestions().catch((err) => fail(err, moreQuestions));
});
`;

const BODY = `<section class="questions card grid gap-6 sm:gap-8" aria-labelledby="questions-title">
<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
<div class="grid gap-1"><h2 class="text-lg" id="questions-title">Questions</h2>
<p class="text-xs text-ink-2">The panel logs each email that you reveal.</p></div>
<p class="text-sm text-ink-2 num" id="questions-total">—</p>
<p class="basis-full text-sm text-error" id="questions-reveal-error" role="alert" hidden></p>
<span class="sr-only" id="questions-reveal-status" role="status"></span>
</div>
<table class="data-table questions-table" aria-labelledby="questions-title">
<thead><tr>
<th scope="col" class="w-[20%]">Name</th><th scope="col" class="w-52">Email</th>
<th scope="col" class="w-28">Asked on</th><th scope="col" class="w-36">Status</th>
<th scope="col">Question</th>
</tr></thead>
<tbody id="questions-rows"></tbody>
</table>
<div class="grid justify-items-center gap-3 py-8 text-center text-ink-2" id="questions-blank"
  hidden>${icon("question")}<p class="max-w-[40ch]">Nobody has asked a question yet. A question
from the signup form appears here.</p></div>
<button class="btn btn-quiet btn-on-white justify-self-start" id="questions-more" type="button"
  hidden>Show 50 more</button>
</section>`;

export const QUESTIONS: Section = { body: BODY, script: SCRIPT };
