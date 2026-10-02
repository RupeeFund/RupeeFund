import { afterEach, describe, expect, it, vi } from "vitest";
import { DAILY_DAYS } from "./sql.ts";
import { answerFor, mount, unmount, SUMMARY, viewData } from "./testkit-dom.ts";

async function boot(summary: unknown = SUMMARY): Promise<void> {
  const data = { ...viewData(), summary };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => Response.json(answerFor(path, data))),
  );
  mount("/");
  await vi.waitFor(() =>
    expect(document.querySelector("#figure-active")?.textContent).not.toBe("—"),
  );
}

function withTotals(totals: Partial<typeof SUMMARY.totals>): typeof SUMMARY {
  return { ...SUMMARY, totals: { ...SUMMARY.totals, ...totals } };
}

function figure(key: string): [string | null | undefined, string | null | undefined] {
  return [
    document.querySelector(`#figure-${key}`)?.textContent,
    document.querySelector(`#figure-${key}-note`)?.textContent,
  ];
}

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
});

describe("the numbers section", () => {
  it("counts the active signups against the goal of 1,000, and names who left", async () => {
    await boot(withTotals({ total: 415, active: 412 }));
    expect([...figure("active"), document.querySelector("#numbers-scope")?.textContent]).toEqual([
      "412",
      "41% of 1,000",
      "Every count leaves out the 3 people who unsubscribed.",
    ]);
  });

  it("claims no 100% of the goal before the list reaches it", async () => {
    await boot(withTotals({ total: 999, active: 999 }));
    expect(figure("active")[1]).toBe("99% of 1,000");
  });

  it("gives the signups a day over the last 30 days, and a slow rate as more than 0", async () => {
    await boot(withTotals({ recent_joined: 45 }));
    const fast = figure("rate");
    await boot(withTotals({ recent_joined: 1 }));
    expect([fast, figure("rate")]).toEqual([
      ["1.5", "45 signups in the last 30 days"],
      ["0.033", "1 signup in the last 30 days"],
    ]);
  });

  it("counts the charted signups against the active total", async () => {
    await boot(withTotals({ active: 5 }));
    const part = document.querySelector("#chart-total")?.textContent;
    await boot(withTotals({ active: 4 }));
    expect([part, document.querySelector("#chart-total")?.textContent]).toEqual([
      "4 of 5 signups",
      "4 signups",
    ]);
  });

  it("says how many people answered the roles and the reasons", async () => {
    await boot(withTotals({ roles_answered: 2, reasons_answered: 0 }));
    expect([
      document.querySelector("#roles-base")?.textContent,
      document.querySelector("#reasons-base")?.textContent,
    ]).toEqual(["2 people answered. Each could pick more than one.", "Nobody answered yet."]);
  });

  it("projects the day of 1,000 from the net growth of the last 30 days", async () => {
    await boot(withTotals({ active: 400, recent_joined: 90, recent_left: 30 }));
    expect(figure("goal")).toEqual(["28 Jul 2027", "At the current rate"]);
  });

  it("says the goal is reached once 1,000 are active", async () => {
    await boot(withTotals({ active: 1000, recent_joined: 0 }));
    expect(figure("goal")).toEqual(["Reached", ""]);
  });

  it("gives no date while the list did not grow in the last 30 days", async () => {
    await boot(withTotals({ recent_joined: 0 }));
    const still = figure("goal");
    await boot(withTotals({ recent_joined: 30, recent_left: 30 }));
    expect([still, figure("goal")]).toEqual([
      ["No estimate", "No growth in the last 30 days"],
      ["No estimate", "No growth in the last 30 days"],
    ]);
  });

  it("sums the monthly amounts and names the median amount", async () => {
    await boot();
    expect([figure("monthly"), figure("median")]).toEqual([
      ["₹1,140", "From 3 people"],
      ["₹500", undefined],
    ]);
  });

  it("says so when nobody gave an amount, rather than a median of nothing", async () => {
    await boot({ ...SUMMARY, pledges: { count: 0, sum: 0, median: null } });
    expect([figure("monthly"), figure("median")]).toEqual([
      ["₹0", "No amounts yet"],
      ["None", undefined],
    ]);
  });

  it("counts every audience role and every reason for joining", async () => {
    await boot();
    const counts = [...document.querySelectorAll("[data-count]")].map((slot) => [
      slot.getAttribute("data-count"),
      slot.textContent,
    ]);
    expect(counts).toEqual([
      ["is_user", "2"],
      ["is_creator", "1"],
      ["is_professional", "0"],
      ["is_student", "0"],
      ["backs_nascent", "1"],
      ["backs_growing", "2"],
      ["backs_larger", "0"],
    ]);
  });

  it("gives the updates share of the people the form asked", async () => {
    await boot();
    expect(figure("updates_opt_in")).toEqual(["1", "50% of those asked"]);
  });

  it("ends the chart today, so a quiet stretch shows as empty days", async () => {
    await boot({ ...SUMMARY, asOf: Date.UTC(2026, 9, 1, 9), byDay: [{ key: "2026-09-20", n: 2 }] });
    const bars = [...document.querySelectorAll(".bar")];
    expect([
      bars.length,
      bars.filter((bar) => bar.hasAttribute("data-empty")).length,
      document.querySelector("#period")?.textContent,
    ]).toEqual([12, 11, "20 September 2026 – 1 October 2026"]);
  });

  it("draws the chart once, however often the counts are read", async () => {
    await boot();
    for (let i = 0; i < 2; i += 1) {
      document.querySelector<HTMLButtonElement>("#refresh")?.click();
      await vi.waitFor(() =>
        expect(document.querySelector("#refresh")?.hasAttribute("data-busy")).toBe(false),
      );
    }
    expect(document.querySelectorAll(".bar")).toHaveLength(3);
    expect(document.querySelectorAll("#daily-data > div")).toHaveLength(3);
    expect(document.querySelectorAll("#x-axis > span")).toHaveLength(3);
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
    expect(document.querySelector("#period")?.textContent).toContain("– 1 October 2026");
  });

  it("says so when nobody has joined, rather than ruling an empty plot", async () => {
    const empty = Object.fromEntries(Object.keys(SUMMARY.totals).map((key) => [key, 0]));
    await boot({
      ...SUMMARY,
      totals: empty,
      pledges: { count: 0, sum: 0, median: null },
      byDay: [],
    });
    expect(document.querySelector<HTMLElement>("#chart-blank")?.hidden).toBe(false);
    expect(document.querySelector("#chart-blank")?.textContent).toMatch(/nobody|no one/i);
    expect(figure("active")).toEqual(["0", "0% of 1,000"]);
  });
});
