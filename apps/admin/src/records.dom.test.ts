import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOSTILE_NAME, mount, REVEALED, ROW, stubDialogs, SUMMARY } from "./testkit-dom.ts";

let asked: string[];
let row: typeof ROW;

function serve(path: string): unknown {
  if (path === "/api/summary") return SUMMARY;
  if (path.startsWith("/api/waitlist")) return { rows: [row], next: null };
  if (path.startsWith("/api/reveal/")) return { id: ROW.id, email: REVEALED };
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
  mount("/records");
  await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
}

function openRecord(): void {
  document.querySelector<HTMLButtonElement>(".row-action button")?.click();
}

beforeEach(() => {
  stubDialogs();
  asked = [];
  row = ROW;
  window.history.replaceState(null, "", "/records");
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "__pwned");
});

describe("the records page", () => {
  it("fetches only what the view needs, in the order that loads each page one time", async () => {
    await boot();
    expect(asked).toEqual(["/api/summary", "/api/waitlist"]);
  });

  it("shows the masked address, never the whole one, before a reveal", async () => {
    await boot();
    expect(document.querySelector(".person-address")?.textContent).toBe(ROW.email_masked);
    expect(document.body.textContent).not.toContain(REVEALED);
  });

  it("renders a hostile name as text, running no markup it carries", async () => {
    await boot();
    expect(document.querySelector(".person-name")?.textContent).toBe(HOSTILE_NAME);
    expect(document.querySelectorAll("#rows img")).toHaveLength(0);
    expect(Reflect.get(globalThis, "__pwned")).toBeUndefined();
  });

  it("opens the record before it offers the address", async () => {
    await boot();
    expect(document.querySelector<HTMLDialogElement>("#record-dialog")?.open).toBeFalsy();
    openRecord();
    expect(document.querySelector<HTMLDialogElement>("#record-dialog")?.open).toBe(true);
    expect(document.querySelector("#detail-address")?.textContent).toBe(ROW.email_masked);
    expect(document.querySelector("#detail-amount")?.textContent).toBe("₹500");
    expect(document.querySelector("#detail-months")?.textContent).toBe("not given");
  });

  it("writes money the Indian way and a date in words, per the brand", async () => {
    row = { ...ROW, amount: "100000" };
    await boot();
    openRecord();
    expect(document.querySelector("#detail-amount")?.textContent).toBe("₹1,00,000");
    expect(document.querySelector("#detail-joined")?.textContent).toBe("14 November 2023");
  });

  it("asks the Worker for the address when the reveal is pressed", async () => {
    await boot();
    openRecord();
    document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
    await vi.waitFor(() => expect(asked).toContain("/api/reveal/7"));
    await vi.waitFor(() =>
      expect(document.querySelector("#detail-address")?.textContent).toBe(REVEALED),
    );
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

  it("puts the first focus on the control the record exists to offer", async () => {
    await boot();
    openRecord();
    expect(document.querySelector("#detail-reveal")?.hasAttribute("autofocus")).toBe(true);
  });

  it("closes the record and names a recovery when a reveal fails", async () => {
    await boot();
    openRecord();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    document.querySelector<HTMLButtonElement>("#detail-reveal")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(false),
    );
    expect(document.querySelector<HTMLDialogElement>("#record-dialog")?.open).toBe(false);
    expect(document.querySelector("#error")?.textContent).not.toContain("500");
  });

  it("spells a status one way, in the filter and on the row alike", async () => {
    await boot();
    const options = [...document.querySelectorAll("#filter-status option")]
      .map((option) => option.textContent)
      .filter((label) => label !== "All statuses");
    expect(options).toEqual(["new", "exported", "removed"]);
    expect(document.querySelector(".badge")?.textContent).toBe("new");
    openRecord();
    expect(document.querySelector("#detail-state")?.textContent).toBe("new");
  });

  it("hides the button when the last page has arrived", async () => {
    await boot();
    expect(document.querySelector<HTMLButtonElement>("#more")?.hidden).toBe(true);
  });

  it("narrows the loaded rows on a filter and says the reach is the loaded set", async () => {
    await boot();
    const status = document.querySelector<HTMLSelectElement>("#filter-status");
    if (status !== null) status.value = "removed";
    status?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector<HTMLElement>("#rows tr")?.hidden).toBe(true);
    expect(document.querySelector("#shown")?.textContent).toContain("0 of 1 loaded");
    expect(document.querySelector("#blank-copy")?.textContent).toMatch(/no loaded record matches/i);
  });

  it("carries the filters in the address, so leaving and returning keeps them", async () => {
    await boot();
    const status = document.querySelector<HTMLSelectElement>("#filter-status");
    if (status !== null) status.value = "exported";
    status?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(window.location.search).toContain("status=exported");

    window.history.replaceState(null, "", "/records?status=removed&q=asha");
    asked = [];
    stubFetch();
    mount("/records");
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
    expect(document.querySelector<HTMLSelectElement>("#filter-status")?.value).toBe("removed");
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
    mount("/records");

    document.querySelector<HTMLButtonElement>("#more")?.click();
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));

    release();
    await vi.waitFor(() =>
      expect(document.querySelector("#records-total")?.textContent).toMatch(/4/),
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });
    expect(document.querySelectorAll("#rows tr")).toHaveLength(1);
  });

  it("says so when nobody has joined, rather than showing a bare header row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        Response.json(path.startsWith("/api/waitlist") ? { rows: [], next: null } : SUMMARY),
      ),
    );
    mount("/records");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#blank")?.hidden).toBe(false),
    );
    expect(document.querySelector("#blank-copy")?.textContent).toMatch(/nobody|no one/i);
    expect(document.querySelector<HTMLElement>("#more")?.hidden).toBe(true);
  });

  it("still counts the rows it has when the totals never arrive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path === "/api/summary") return new Response("nope", { status: 500 });
        return Response.json(serve(path));
      }),
    );
    mount("/records");
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
    expect(document.querySelector("#shown")?.textContent).not.toContain("of 0");
    expect(document.querySelector("#shown")?.textContent).toContain("1 loaded");
  });

  it("names a way to recover when the Worker refuses, with the control to do it", async () => {
    const refuse = vi.fn(async () => new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", refuse);
    mount("/records");
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
