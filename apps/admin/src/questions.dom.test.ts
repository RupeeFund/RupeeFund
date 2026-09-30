import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOSTILE_NAME, HOSTILE_QUESTION, mount, QUESTION, SUMMARY } from "./testkit-dom.ts";

let asked: string[];

const WHOLE_LIST = { ...SUMMARY, totals: { ...SUMMARY.totals, questions: 19 } };

function serve(path: string): unknown {
  if (path === "/api/summary") return WHOLE_LIST;
  if (path.startsWith("/api/questions")) return { rows: [QUESTION], next: null };
  throw new Error(`unexpected path ${path}`);
}

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      asked.push(path);
      return Response.json(serve(path));
    }),
  );
}

async function boot(): Promise<void> {
  stubFetch();
  mount("/questions");
  await vi.waitFor(() => expect(document.querySelectorAll("#list .question")).toHaveLength(1));
}

beforeEach(() => {
  asked = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "__pwned");
});

describe("the questions page", () => {
  it("fetches only what the view needs, in the order that loads each page one time", async () => {
    await boot();
    expect(asked).toEqual(["/api/summary", "/api/questions"]);
  });

  it("reads no row through the list endpoint, which carries no question", async () => {
    await boot();
    expect(asked.some((path) => path.startsWith("/api/waitlist"))).toBe(false);
  });

  it("renders a hostile question as text, running no markup it carries", async () => {
    await boot();
    expect(document.querySelector(".question-body")?.textContent).toBe(HOSTILE_QUESTION);
    expect(document.querySelectorAll("#list img")).toHaveLength(0);
    expect(Reflect.get(globalThis, "__pwned")).toBeUndefined();
  });

  it("renders a hostile name as text too", async () => {
    await boot();
    expect(document.querySelector(".person-name")?.textContent).toBe(HOSTILE_NAME);
  });

  it("shows the masked address and offers no reveal, because the page is a read", async () => {
    await boot();
    expect(document.querySelector(".person-address")?.textContent).toBe(QUESTION.email_masked);
    expect(document.querySelector("#record-dialog")).toBeNull();
    expect(document.querySelector("#detail-reveal")).toBeNull();
    expect(document.body.textContent).toMatch(/•••@/);
  });

  it("counts the questions from the totals, not from the rows it loaded", async () => {
    await boot();
    expect(document.querySelectorAll("#list .question")).toHaveLength(1);
    expect(document.querySelector("#questions-total")?.textContent).toContain("19");
  });

  it("hides the button when the last page has arrived", async () => {
    await boot();
    expect(document.querySelector<HTMLElement>("#more")?.hidden).toBe(true);
  });

  it("marks a person who left, so the reader answers nobody twice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        Response.json(
          path.startsWith("/api/questions")
            ? { rows: [{ ...QUESTION, unsubscribed_at: 1 }], next: null }
            : SUMMARY,
        ),
      ),
    );
    mount("/questions");
    await vi.waitFor(() => expect(document.querySelectorAll("#list .question")).toHaveLength(1));
    expect(document.querySelector(".badge")?.textContent).toBe("removed");
  });

  it("says so when nobody has asked anything", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        Response.json(path.startsWith("/api/questions") ? { rows: [], next: null } : SUMMARY),
      ),
    );
    mount("/questions");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#blank")?.hidden).toBe(false),
    );
    expect(document.querySelector("#blank-copy")?.textContent).toMatch(/nobody|no one/i);
    expect(document.querySelector<HTMLElement>("#more")?.hidden).toBe(true);
  });

  it("names a way to recover when the Worker refuses, with the control to do it", async () => {
    const refuse = vi.fn(async () => new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", refuse);
    mount("/questions");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(false),
    );
    const shown = document.querySelector("#error")?.textContent ?? "";
    expect(shown).toMatch(/try again/i);
    expect(shown).not.toContain("403");

    const calls = refuse.mock.calls.length;
    document.querySelector<HTMLButtonElement>("#retry")?.click();
    await vi.waitFor(() => expect(refuse.mock.calls.length).toBeGreaterThan(calls));
  });
});
