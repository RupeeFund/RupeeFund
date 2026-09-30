import { page } from "./chrome.ts";
import { icon } from "./icons.ts";

const SCRIPT = `
let cursor = null;

function meta(row) {
  const wrap = el("div", undefined, "question-meta");
  wrap.append(el("span", longDay(row.created_at)));
  if (row.unsubscribed_at !== null) {
    const badge = el("span", undefined, "badge");
    badge.dataset.state = "removed";
    badge.append(use("minus"), el("span", "removed"));
    wrap.append(badge);
  }
  return wrap;
}

function card(row) {
  const head = el("div", undefined, "question-head");
  head.append(person(row), meta(row));
  const item = el("article", undefined, "question");
  item.append(head, el("p", row.question, "question-body"));
  return item;
}

async function more() {
  const button = byId("more");
  if (button.disabled || button.hidden) return;
  button.disabled = true;
  try {
    const path = "/api/questions" + (cursor === null ? "" : "?before=" + cursor);
    const answer = await get(path);
    const list = byId("list");
    for (const row of answer.rows) list.append(card(row));
    cursor = answer.next;
    button.hidden = cursor === null;
    byId("blank").hidden = list.children.length > 0;
  } finally {
    button.disabled = false;
  }
}

byId("more").addEventListener("click", () => {
  more().catch(fail);
});

boot(async () => {
  try {
    const summary = await get("/api/summary");
    setNavCount(summary.totals.total);
    byId("questions-total").textContent = summary.totals.questions + " asked";
  } catch (err) {
    console.error(err);
  }
  await more();
});
`;

const BODY = `<section class="flex flex-wrap items-end justify-between gap-6"
  aria-labelledby="questions-title">
<div class="grid gap-3 max-w-[40rem]">
<p class="eyebrow text-brand-fg">Waitlist</p>
<h1 class="page-title" id="questions-title">Questions asked</h1>
<p class="text-ink-2">Newest first. Each card holds the words one person wrote on the signup
form. The address stays masked here. Open the record on Records to reveal one.</p>
</div>
<p class="text-sm text-ink-2 num" id="questions-total">—</p>
</section>
<section class="card grid gap-6" aria-labelledby="questions-title">
<div class="grid" id="list"></div>
<div class="grid justify-items-center gap-3 py-8 text-center text-ink-2" id="blank" hidden>
${icon("question")}<p class="max-w-[40ch]" id="blank-copy">Nobody has asked a question yet. A
question from the signup form appears here.</p></div>
<div class="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5
  text-xs text-ink-2">
<button class="btn btn-quiet btn-on-white" id="more" type="button">Show 50 more</button>
<span>Only a row that carries a question is read.</span>
</div>
</section>`;

export function questionsPage(): string {
  return page({ path: "/questions", body: BODY, script: SCRIPT });
}
