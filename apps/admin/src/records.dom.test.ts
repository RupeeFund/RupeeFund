import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_HEADER } from "./routes.ts";
import {
  answerFor,
  HOSTILE_NAME,
  mount,
  unmount,
  REVEALED,
  ROW,
  type RowFixture,
  stubDialogs,
  SUMMARY,
  viewData,
} from "./testkit-dom.ts";

let asked: string[];
let row: RowFixture;
let posts: RequestInit[];
let caches: (RequestCache | undefined)[];
let exportAnswer: () => Response;
let summary: typeof SUMMARY;

function serve(path: string): unknown {
  if (path === "/api/summary") return summary;
  if (path.startsWith("/api/waitlist")) return { rows: [row], next: null };
  return answerFor(path, viewData());
}

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      asked.push(path);
      if (path === "/api/summary") caches.push(init.cache);
      if (path === "/api/export") {
        posts.push(init);
        return exportAnswer();
      }
      return Response.json(serve(path));
    }),
  );
}

async function boot(): Promise<void> {
  stubFetch();
  mount("/");
  await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
}

function openRecord(): void {
  document.querySelector<HTMLButtonElement>(".row-action button")?.click();
}

function settle(): Promise<void> {
  return new Promise((done) => {
    setTimeout(done);
  });
}

async function revealThenOpenAnother(): Promise<(late: Response) => void> {
  let answer = (_: Response) => {};
  const late = new Promise<Response>((done) => {
    answer = done;
  });
  const rows = [ROW, { ...ROW, id: 8, name: "Second person" }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      path === "/api/reveal/7" ? late : Response.json(answerFor(path, { ...viewData(), rows })),
    ),
  );
  mount("/");
  await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(2));
  const opens = document.querySelectorAll<HTMLButtonElement>(".row-action button");
  opens[0]?.click();
  document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
  document.querySelector<HTMLButtonElement>("#record-close")?.click();
  opens[1]?.click();
  return answer;
}

beforeEach(() => {
  stubDialogs();
  asked = [];
  posts = [];
  caches = [];
  row = ROW;
  summary = SUMMARY;
  exportAnswer = () =>
    new Response("email,name,attributes\na@example.org,A,{}\n", {
      headers: {
        "content-disposition": 'attachment; filename="rupeefund-export-9.csv"',
        "x-export-at": "9",
        "x-export-count": "1",
      },
    });
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "__pwned");
});

describe("the records section", () => {
  it("shows the masked address, never the whole one, before a reveal", async () => {
    await boot();
    expect(document.querySelector('#rows td[data-label="Email"] .email')?.textContent).toBe(
      ROW.email_masked,
    );
    expect(document.body.textContent).not.toContain(REVEALED);
  });

  it("gives each value its own column", async () => {
    await boot();
    const heads = [...document.querySelectorAll(".records-table thead th")].map(
      (th) => th.textContent,
    );
    const cells = [...document.querySelectorAll("#rows tr > *")].map((cell) => cell.textContent);
    expect([heads, cells]).toEqual([
      [
        "Name",
        "Email",
        "Amount",
        "Months",
        "Roles",
        "Reasons",
        "Updates",
        "Joined",
        "Status",
        "Open the record",
      ],
      [
        HOSTILE_NAME,
        ROW.email_masked,
        "₹500",
        "Not given",
        "User, Student",
        "Nascent, Larger",
        "Yes",
        "14 Nov 2023",
        "New",
        "",
      ],
    ]);
  });

  it("keeps the source out of the table and the filters, and in the record", async () => {
    await boot();
    expect(document.querySelector("#filter-source")).toBeNull();
    openRecord();
    expect(document.querySelector("#detail-source")?.textContent).toBe(ROW.source);
  });

  it("reveals the email in the row and masks it again, asking the Worker one time", async () => {
    await boot();
    const cell = document.querySelector('#rows td[data-label="Email"]');
    const eye = cell?.querySelector<HTMLButtonElement>("button");
    eye?.click();
    await vi.waitFor(() => expect(cell?.querySelector(".email")?.textContent).toBe(REVEALED));
    const shown = eye?.getAttribute("aria-pressed");
    eye?.click();
    expect([
      shown,
      eye?.getAttribute("aria-pressed"),
      cell?.querySelector(".email")?.textContent,
    ]).toEqual(["true", "false", ROW.email_masked]);
    expect(asked.filter((path) => path === "/api/reveal/7")).toHaveLength(1);
  });

  it("names a failed reveal in the row's section and keeps the email masked", async () => {
    await boot();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    document.querySelector<HTMLButtonElement>('#rows td[data-label="Email"] button')?.click();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#records-reveal-error")?.hidden).toBe(false),
    );
    expect(document.querySelector('#rows td[data-label="Email"] .email')?.textContent).toBe(
      ROW.email_masked,
    );
    expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(true);
  });

  it("renders a hostile name as text, running no markup it carries", async () => {
    await boot();
    expect(document.querySelector(".person-name")?.textContent).toBe(HOSTILE_NAME);
    expect(document.querySelectorAll("#rows img")).toHaveLength(0);
    expect(Reflect.get(globalThis, "__pwned")).toBeUndefined();
  });

  it("opens the whole record from the row, the address still masked", async () => {
    await boot();
    expect(document.querySelector<HTMLDialogElement>("#record-dialog")?.open).toBeFalsy();
    openRecord();
    expect(document.querySelector<HTMLDialogElement>("#record-dialog")?.open).toBe(true);
    expect(document.querySelector("#detail-address")?.textContent).toBe(ROW.email_masked);
    expect(document.querySelector("#detail-amount")?.textContent).toBe("₹500");
    expect(document.querySelector("#detail-months")?.textContent).toBe("Not given");
  });

  it("writes money the Indian way and a date in words, per the brand", async () => {
    row = { ...ROW, amount: 100000 };
    await boot();
    openRecord();
    expect(document.querySelector("#detail-amount")?.textContent).toBe("₹1,00,000");
    expect(document.querySelector("#detail-joined")?.textContent).toBe("14 November 2023");
  });

  it("shows a NULL answer as not recorded, apart from an empty one", async () => {
    row = { ...ROW, amount: null, months: "", updates_opt_in: null };
    await boot();
    openRecord();
    expect(
      ["#detail-amount", "#detail-months", "#detail-updates"].map(
        (id) => document.querySelector(id)?.textContent,
      ),
    ).toEqual(["Not recorded", "Not given", "Not recorded"]);
  });

  it("shows the term as the person typed it", async () => {
    row = { ...ROW, months: "12+" };
    await boot();
    openRecord();
    expect(document.querySelector("#detail-months")?.textContent).toBe("12+");
  });

  it("says not recorded for a row the form never asked about the roles", async () => {
    row = { ...ROW, is_user: null, is_creator: null, is_professional: null, is_student: null };
    await boot();
    expect(document.querySelector('#rows td[data-label="Roles"]')?.textContent).toBe(
      "Not recorded",
    );
  });

  it("says none for a row that was asked and ticked no role", async () => {
    row = { ...ROW, is_user: 0, is_creator: 0, is_professional: null, is_student: 0 };
    await boot();
    expect(document.querySelector('#rows td[data-label="Roles"]')?.textContent).toBe("None");
  });

  it("shows each box in the record as stored", async () => {
    await boot();
    openRecord();
    const boxes = ["is_user", "is_creator", "is_professional", "backs_larger"].map(
      (field) => document.querySelector(`#detail-${field}`)?.textContent,
    );
    expect(boxes).toEqual(["Yes", "No", "Not recorded", "Yes"]);
  });

  it("dates the export, the unsubscribe and the last change in the record", async () => {
    row = { ...ROW, exported_at: 1_700_086_400_000, unsubscribed_at: null };
    await boot();
    openRecord();
    const dates = ["exported", "unsubscribed", "updated"].map(
      (field) => document.querySelector(`#detail-${field}`)?.textContent,
    );
    expect(dates).toEqual(["15 November 2023", "No", "14 November 2023"]);
  });

  it("asks the Worker for the address when the reveal is pressed", async () => {
    await boot();
    openRecord();
    document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
    await vi.waitFor(() => expect(asked).toContain("/api/reveal/7"));
    await vi.waitFor(() =>
      expect(document.querySelector("#detail-address")?.textContent).toBe(REVEALED),
    );
    const [, init] = vi.mocked(fetch).mock.calls.find(([path]) => path === "/api/reveal/7") ?? [];
    expect(new Headers(init?.headers).get(PANEL_HEADER)).toBe("1");
  });

  it("hides the address again on a second press, asking the Worker one time", async () => {
    await boot();
    openRecord();
    const reveal = document.querySelector<HTMLButtonElement>("#detail-reveal");
    reveal?.click();
    await vi.waitFor(() => expect(asked).toContain("/api/reveal/7"));
    reveal?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#detail-address")?.textContent).toBe(ROW.email_masked),
    );
    expect(document.body.textContent).not.toContain(REVEALED);
    expect(asked.filter((path) => path.startsWith("/api/reveal/"))).toHaveLength(1);
  });

  it("keeps a late reveal for one record out of the record opened after it", async () => {
    const answer = await revealThenOpenAnother();
    answer(Response.json({ id: 7, email: REVEALED }));
    await settle();
    expect([
      document.querySelector("#detail-name")?.textContent,
      document.querySelector("#detail-address")?.textContent,
      document.querySelector("#detail-reveal")?.getAttribute("aria-pressed"),
    ]).toEqual(["Second person", ROW.email_masked, "false"]);
  });

  it("keeps a late failed reveal for one record out of the record opened after it", async () => {
    const answer = await revealThenOpenAnother();
    answer(new Response("nope", { status: 500 }));
    await settle();
    expect(document.querySelector<HTMLElement>("#reveal-error")?.hidden).toBe(true);
  });

  it("reveals the record opened next while a late reveal for the last one is out", async () => {
    const answer = await revealThenOpenAnother();
    const reveal = document.querySelector<HTMLButtonElement>("#detail-reveal");
    reveal?.click();
    await vi.waitFor(() => expect(reveal?.getAttribute("aria-pressed")).toBe("true"));
    answer(Response.json({ id: 7, email: "late@example.org" }));
    await settle();
    expect(document.querySelector("#detail-address")?.textContent).toBe(REVEALED);
  });

  it("holds the toggle name steady, leaving the state to aria-pressed alone", async () => {
    await boot();
    openRecord();
    const reveal = document.querySelector<HTMLButtonElement>("#detail-reveal");
    expect(reveal?.getAttribute("aria-pressed")).toBe("false");
    const name = reveal?.textContent;
    reveal?.click();
    await vi.waitFor(() => expect(reveal?.getAttribute("aria-pressed")).toBe("true"));
    expect(reveal?.textContent).toBe(name);
  });

  it("puts the first focus on Close, not on the reveal the log records", async () => {
    await boot();
    openRecord();
    expect(document.querySelector("#record-close")?.hasAttribute("autofocus")).toBe(true);
    expect(document.querySelector("#detail-reveal")?.hasAttribute("autofocus")).toBe(false);
  });

  it("keeps the record open on a failed reveal and retries the reveal itself", async () => {
    await boot();
    openRecord();
    const fail = vi.fn(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fail);
    document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#reveal-error")?.hidden).toBe(false),
    );
    expect(document.querySelector<HTMLDialogElement>("#record-dialog")?.open).toBe(true);
    expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(true);
    expect(document.querySelector("#reveal-error")?.textContent).not.toContain("500");
    stubFetch();
    document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#detail-address")?.textContent).toBe(REVEALED),
    );
    expect(document.querySelector<HTMLElement>("#reveal-error")?.hidden).toBe(true);
  });

  it("announces the reveal, since the toggle name holds steady", async () => {
    await boot();
    openRecord();
    document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#reveal-status")?.textContent).toMatch(/shown/i),
    );
    expect(document.querySelector("#reveal-status")?.getAttribute("role")).toBe("status");
  });

  it("spells a status one way, in the filter and on the row alike", async () => {
    await boot();
    const options = [...document.querySelectorAll("#filter-status option")]
      .map((option) => option.textContent)
      .filter((label) => label !== "All statuses");
    expect(options).toEqual(["New", "Exported", "Unsubscribed"]);
    expect(document.querySelector("#rows .status-mark")?.textContent).toBe("New");
    openRecord();
    expect(document.querySelector("#detail-state")?.textContent).toBe("New");
  });

  it("narrows the loaded rows on a filter and says the reach is the loaded set", async () => {
    await boot();
    const status = document.querySelector<HTMLSelectElement>("#filter-status");
    if (status !== null) status.value = "unsubscribed";
    status?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector<HTMLElement>("#rows tr")?.hidden).toBe(true);
    expect(document.querySelector("#shown")?.textContent).toContain("0 of 1 loaded");
    expect(document.querySelector("#records-blank-copy")?.textContent).toMatch(
      /no loaded record matches/i,
    );
  });

  it("carries the filters in the address, so leaving and returning keeps them", async () => {
    await boot();
    const status = document.querySelector<HTMLSelectElement>("#filter-status");
    if (status !== null) status.value = "exported";
    status?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(window.location.search).toContain("status=exported");

    window.history.replaceState(null, "", "/?status=unsubscribed&q=asha");
    asked = [];
    stubFetch();
    mount("/");
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
    expect(document.querySelector<HTMLSelectElement>("#filter-status")?.value).toBe("unsubscribed");
    expect(document.querySelector<HTMLInputElement>("#search")?.value).toBe("asha");
  });

  it("loads each page one time, even when the button is pressed mid-load", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        asked.push(path);
        if (path === "/api/summary") await gate;
        return Response.json(serve(path));
      }),
    );
    mount("/");

    document.querySelector<HTMLButtonElement>("#records-more")?.click();
    release();
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });
    expect(document.querySelectorAll("#rows tr")).toHaveLength(1);
    expect(asked.filter((path) => path.startsWith("/api/waitlist"))).toHaveLength(1);
  });

  it("says so when nobody has joined, rather than showing a bare header row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        Response.json(
          path.startsWith("/api/waitlist") ? { rows: [], next: null } : answerFor(path, viewData()),
        ),
      ),
    );
    mount("/");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#records-blank")?.hidden).toBe(false),
    );
    expect(document.querySelector("#records-blank-copy")?.textContent).toMatch(/nobody|no one/i);
    expect(document.querySelector<HTMLElement>("#records-more")?.hidden).toBe(true);
  });

  it("hides Show 50 more until the first page has loaded", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path.startsWith("/api/waitlist")) await gate;
        return Response.json(
          path.startsWith("/api/waitlist") ? { rows: [ROW], next: 5 } : answerFor(path, viewData()),
        );
      }),
    );
    mount("/");
    expect(document.querySelector<HTMLElement>("#records-more")?.hidden).toBe(true);
    release();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#records-more")?.hidden).toBe(false),
    );
  });

  it("moves focus to the first new row when the last page hides the button", async () => {
    let page = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (!path.startsWith("/api/waitlist")) return Response.json(answerFor(path, viewData()));
        page += 1;
        return Response.json({ rows: [{ ...ROW, id: page }], next: page === 1 ? 1 : null });
      }),
    );
    mount("/");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#records-more")?.hidden).toBe(false),
    );
    const more = document.querySelector<HTMLButtonElement>("#records-more");
    more?.focus();
    more?.click();
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(2));
    expect(document.activeElement).toBe(
      document.querySelectorAll("#rows tr .row-action button")[1],
    );
  });

  it("announces the match count once typing pauses", async () => {
    await boot();
    const status = document.querySelector("#match-status")!;
    status.textContent = "";
    vi.useFakeTimers();
    const search = document.querySelector<HTMLInputElement>("#search");
    if (search !== null) search.value = "zzzz";
    search?.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(599);
    expect(status.textContent).toBe("");
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
    expect(status.textContent).toContain("0 of 1 loaded");
    expect(document.querySelector("#match-status")?.getAttribute("role")).toBe("status");
  });

  it("keeps focus on the page when the last page brings no rows", async () => {
    let page = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (!path.startsWith("/api/waitlist")) return Response.json(answerFor(path, viewData()));
        page += 1;
        return Response.json(page === 1 ? { rows: [ROW], next: 1 } : { rows: [], next: null });
      }),
    );
    mount("/");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#records-more")?.hidden).toBe(false),
    );
    const more = document.querySelector<HTMLButtonElement>("#records-more");
    more?.focus();
    more?.click();
    await vi.waitFor(() => expect(more?.hidden).toBe(true));
    expect(document.activeElement?.id).toBe("main");
  });

  it("names a missing record rather than blaming the server", async () => {
    await boot();
    openRecord();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#reveal-error")?.hidden).toBe(false),
    );
    expect(document.querySelector("#reveal-error")?.textContent).toMatch(/reload/i);
    expect(document.querySelector("#reveal-error")?.textContent).not.toMatch(/server/i);
  });
});

describe("the export", () => {
  let saved: string[];

  beforeEach(() => {
    saved = [];
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL() {} }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        saved.push(this.download);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openExport(): Promise<HTMLDialogElement> {
    await boot();
    document.querySelector<HTMLButtonElement>("#export-open")?.click();
    const dialog = document.querySelector<HTMLDialogElement>("#export-dialog")!;
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    return dialog;
  }

  it("states how many people wait before anything is written", async () => {
    const dialog = await openExport();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("2 people");
    expect(posts).toHaveLength(0);
  });

  it("posts with the panel header, saves the file, and reports the count", async () => {
    await openExport();
    document.querySelector<HTMLButtonElement>("#export-confirm")?.click();
    await vi.waitFor(() => expect(saved).toEqual(["rupeefund-export-9.csv"]));
    expect(posts[0]?.method).toBe("POST");
    expect(new Headers(posts[0]?.headers).get(PANEL_HEADER)).toBe("1");
    expect(document.querySelector("#export-dialog")?.hasAttribute("open")).toBe(false);
    expect(document.querySelector("#export-status")?.textContent).toContain("Exported 1 person");
    await vi.waitFor(() => expect(caches).toEqual(["no-cache", "no-cache", "no-cache"]));
    await vi.waitFor(() =>
      expect(asked.filter((path) => path.startsWith("/api/waitlist"))).toHaveLength(2),
    );
    await vi.waitFor(() =>
      expect(asked.filter((path) => path.startsWith("/api/questions"))).toHaveLength(2),
    );
  });

  it("offers no export when nobody waits", async () => {
    summary = { ...SUMMARY, totals: { ...SUMMARY.totals, pending: 0 } };
    const dialog = await openExport();
    expect(dialog.textContent).toContain("No one is waiting for export.");
    expect(document.querySelector<HTMLButtonElement>("#export-confirm")?.hidden).toBe(true);
  });

  it("keeps the dialog open and names the recovery when the server refuses", async () => {
    exportAnswer = () => new Response(null, { status: 403 });
    const dialog = await openExport();
    document.querySelector<HTMLButtonElement>("#export-confirm")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#export-error")?.textContent).toContain("sign in"),
    );
    expect(dialog.open).toBe(true);
    expect(saved).toEqual([]);
  });

  it("says the people were marked when the file fails after the stamp", async () => {
    exportAnswer = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("dropped"));
          },
        }),
        { headers: { "x-export-at": "9", "x-export-count": "1" } },
      );
    await openExport();
    document.querySelector<HTMLButtonElement>("#export-confirm")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#export-status")?.textContent).toContain("batch 9"),
    );
    expect(document.querySelector("#export-status")?.textContent).toContain("marked as exported");
    expect(saved).toEqual([]);
  });

  it("reports a batch that the server found empty without saving a file", async () => {
    exportAnswer = () => new Response(null, { status: 204 });
    await openExport();
    document.querySelector<HTMLButtonElement>("#export-confirm")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#export-status")?.textContent).toContain("No one"),
    );
    expect(saved).toEqual([]);
  });
});
