import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAILY_DAYS } from "./sql.ts";
import { mount, SUMMARY } from "./testkit-dom.ts";

let asked: string[];

function serveWith(summary: unknown) {
  return vi.fn(async (path: string) => {
    asked.push(path);
    if (path === "/api/summary") return Response.json(summary);
    throw new Error(`unexpected path ${path}`);
  });
}

async function boot(summary: unknown = SUMMARY): Promise<void> {
  vi.stubGlobal("fetch", serveWith(summary));
  mount("/");
  await vi.waitFor(() => expect(document.querySelector("#kpi-total")?.textContent).toBe("4"));
}

beforeEach(() => {
  asked = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the overview page", () => {
  it("fetches only what the view needs, and never reads a row", async () => {
    await boot();
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });
    expect(asked).toEqual(["/api/summary"]);
  });

  it("counts the totals onto the cards, with a share of the list beside each", async () => {
    await boot();
    expect(document.querySelectorAll(".kpi")).toHaveLength(4);
    expect(document.querySelector("#kpi-active")?.textContent).toBe("3");
    expect(document.querySelector("#kpi-active-caption")?.textContent).toBe("75% of the list");
  });

  it("keeps every audience role in the community strip", async () => {
    await boot();
    expect(document.querySelector("#community-foss_users")?.textContent).toBe("2");
    expect(document.querySelector("#community-students")?.textContent).toBe("0");
  });

  it("draws a bar for every day in the window, including a day nobody joined", async () => {
    await boot();
    expect(document.querySelectorAll(".bar")).toHaveLength(3);
    expect(document.querySelector("#period")?.textContent).toBe("1 January 2026 – 3 January 2026");
  });

  it("keeps the chart inside the window the query asks for, however sparse the data", async () => {
    await boot({
      ...SUMMARY,
      byDay: [
        { key: "2020-01-01", n: 1 },
        { key: "2026-06-01", n: 1 },
      ],
    });
    expect(document.querySelectorAll(".bar")).toHaveLength(DAILY_DAYS);
    expect(document.querySelector("#period")?.textContent).toContain("– 1 June 2026");
  });

  it("says so when nobody has joined, rather than ruling an empty plot", async () => {
    await vi.stubGlobal(
      "fetch",
      serveWith({
        totals: {
          total: 0,
          active: 0,
          exported: 0,
          updates_opt_in: 0,
          questions: 0,
          foss_users: 0,
          foss_contributors: 0,
          students: 0,
        },
        bySource: [],
        byAmount: [],
        byMonths: [],
        byDay: [],
      }),
    );
    mount("/");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#chart-blank")?.hidden).toBe(false),
    );
    expect(document.querySelector("#chart-blank")?.textContent).toMatch(/nobody|no one/i);
    expect(document.querySelector("#kpi-total-caption")?.textContent).toMatch(
      /nothing|no one|yet/i,
    );
  });

  it("names an empty key rather than leaving the row blank", async () => {
    await boot();
    document.querySelector<HTMLButtonElement>('[data-facet="months"]')?.click();
    expect(document.querySelector("#tallies")?.textContent).toContain("not given");
  });

  it("tells the nav how many records there are to open", async () => {
    await boot();
    for (const slot of document.querySelectorAll(".nav .count")) {
      expect(slot.textContent).toBe("4");
    }
  });

  it("names a way to recover when the Worker refuses, with the control to do it", async () => {
    const refuse = vi.fn(async () => new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", refuse);
    mount("/");
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

  it("runs one attempt at a time, however fast the retry is pressed", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = vi.fn(async () => {
      await gate;
      return new Response("nope", { status: 503 });
    });
    vi.stubGlobal("fetch", slow);
    mount("/");
    await vi.waitFor(() => expect(slow.mock.calls).toHaveLength(1));

    const retry = document.querySelector<HTMLButtonElement>("#retry");
    retry?.click();
    retry?.click();
    expect(slow.mock.calls).toHaveLength(1);

    release();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(false),
    );
    expect(retry?.disabled).toBe(false);
    expect(document.querySelector("#main")?.getAttribute("aria-busy")).toBe("false");
  });

  it("tells assistive technology while the figures are still on their way", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await gate;
        return Response.json(SUMMARY);
      }),
    );
    mount("/");
    expect(document.querySelector("#main")?.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector("#loading")?.textContent).toMatch(/loading|reading/i);
    release();
    await vi.waitFor(() =>
      expect(document.querySelector("#main")?.getAttribute("aria-busy")).toBe("false"),
    );
    expect(document.querySelector<HTMLElement>("#loading")?.hidden).toBe(true);
  });
});
