import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answerFor,
  HOSTILE_NAME,
  HOSTILE_QUESTION,
  mount,
  unmount,
  QUESTION,
  REVEALED,
  SUMMARY,
  viewData,
} from "./testkit-dom.ts";

const WHOLE_LIST = { ...SUMMARY, totals: { ...SUMMARY.totals, questions: 19 } };

async function boot(questions: unknown[] = [QUESTION]): Promise<void> {
  const data = { ...viewData(), summary: WHOLE_LIST, questions };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => Response.json(answerFor(path, data))),
  );
  mount("/");
  await vi.waitFor(() =>
    expect(document.querySelector("#main")?.getAttribute("aria-busy")).toBe("false"),
  );
}

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "__pwned");
});

describe("the questions section", () => {
  it("renders a hostile question as text, running no markup it carries", async () => {
    await boot();
    expect(document.querySelector(".question-body")?.textContent).toBe(HOSTILE_QUESTION);
    expect(document.querySelectorAll("#questions-rows img")).toHaveLength(0);
    expect(Reflect.get(globalThis, "__pwned")).toBeUndefined();
  });

  it("gives each value its own column, as the records table does", async () => {
    await boot();
    const heads = [...document.querySelectorAll(".questions-table thead th")].map(
      (th) => th.textContent,
    );
    const cells = [...document.querySelectorAll("#questions-rows tr > *")].map(
      (cell) => cell.textContent,
    );
    expect([heads, cells]).toEqual([
      ["Name", "Email", "Asked on", "Status", "Question"],
      [HOSTILE_NAME, QUESTION.email_masked, "14 Nov 2023", "New", HOSTILE_QUESTION],
    ]);
  });

  it("reveals the email in a question row through the logged reveal", async () => {
    await boot();
    const cell = document.querySelector('#questions-rows td[data-label="Email"]');
    cell?.querySelector<HTMLButtonElement>("button")?.click();
    await vi.waitFor(() => expect(cell?.querySelector(".email")?.textContent).toBe(REVEALED));
  });

  it("counts the questions from the totals, not from the rows it loaded", async () => {
    await boot();
    expect(document.querySelectorAll("#questions-rows tr")).toHaveLength(1);
    expect(document.querySelector("#questions-total")?.textContent).toContain("19");
  });

  it("marks a person who left, so the reader answers nobody twice", async () => {
    await boot([{ ...QUESTION, unsubscribed_at: 1 }]);
    expect(document.querySelector('#questions-rows td[data-label="Status"]')?.textContent).toBe(
      "Unsubscribed",
    );
  });

  it("says so when nobody has asked anything", async () => {
    await boot([]);
    expect(document.querySelector<HTMLElement>("#questions-blank")?.hidden).toBe(false);
    expect(document.querySelector("#questions-blank")?.textContent).toMatch(/nobody|no one/i);
    expect(document.querySelector<HTMLElement>("#questions-more")?.hidden).toBe(true);
  });
});
