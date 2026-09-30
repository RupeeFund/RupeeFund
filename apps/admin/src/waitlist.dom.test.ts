import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerFor, mount, viewData } from "./testkit-dom.ts";

const LOAD = ["/api/summary", "/api/waitlist", "/api/questions"];

let asked: string[];

function serve(fail: (path: string) => Response | undefined = () => undefined) {
  const data = viewData();
  const fetch = vi.fn(async (path: string) => {
    asked.push(path);
    return fail(path) ?? Response.json(answerFor(path, data));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function boot(): Promise<void> {
  serve();
  mount("/");
  await vi.waitFor(() => expect(asked).toEqual(LOAD));
  await vi.waitFor(() =>
    expect(document.querySelector("#main")?.getAttribute("aria-busy")).toBe("false"),
  );
}

async function failed(): Promise<string> {
  await vi.waitFor(() => expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(false));
  return document.querySelector("#error")?.textContent ?? "";
}

const press = (id: string): void => {
  document.querySelector<HTMLButtonElement>(id)?.click();
};

const toggle = (): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>("#sidebar-toggle");

beforeEach(() => {
  asked = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the waitlist view", () => {
  it("fetches only what the view needs: counts, one page of rows, one of questions", async () => {
    await boot();
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });
    expect(asked).toEqual(LOAD);
  });

  it("names a way to recover when the Worker refuses, with the control to do it", async () => {
    const refuse = serve(() => new Response("nope", { status: 403 }));
    mount("/");
    const shown = await failed();
    expect(shown).toMatch(/try again/i);
    expect(shown).toMatch(/sign in/i);
    expect(shown).not.toContain("403");

    const calls = refuse.mock.calls.length;
    press("#retry");
    await vi.waitFor(() => expect(refuse.mock.calls.length).toBeGreaterThan(calls));
  });

  it("loads each first page once when Try again follows a partial failure", async () => {
    let down = true;
    serve((path) =>
      down && path.startsWith("/api/questions") ? new Response("nope", { status: 500 }) : undefined,
    );
    mount("/");
    await failed();
    down = false;
    press("#retry");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(true),
    );
    await vi.waitFor(() => expect(document.querySelectorAll("#questions-rows tr")).toHaveLength(1));
    expect(document.querySelectorAll("#rows tr")).toHaveLength(1);
  });

  it("still shows the rows when the counts fail", async () => {
    serve((path) => (path === "/api/summary" ? new Response("nope", { status: 500 }) : undefined));
    mount("/");
    await failed();
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
    expect(document.querySelector("#shown")?.textContent).toBe("1 loaded");
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
    await vi.waitFor(() => expect(slow.mock.calls).toHaveLength(LOAD.length));

    press("#retry");
    press("#retry");
    expect(slow.mock.calls).toHaveLength(LOAD.length);

    release();
    await failed();
    expect(document.querySelector<HTMLButtonElement>("#retry")?.disabled).toBe(false);
    expect(document.querySelector("#main")?.getAttribute("aria-busy")).toBe("false");
  });

  it("tells assistive technology while the figures are still on their way", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const data = viewData();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        await gate;
        return Response.json(answerFor(path, data));
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

  it("blames the server, not the connection, when the Worker fails", async () => {
    serve(() => new Response("nope", { status: 500 }));
    mount("/");
    const shown = await failed();
    expect(shown).toMatch(/server/i);
    expect(shown).not.toMatch(/connection|sign in/i);
  });

  it("blames the connection when no answer arrives", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    mount("/");
    expect(await failed()).toMatch(/connection/i);
  });

  it("moves focus to the page when Try again hides itself", async () => {
    let down = true;
    serve(() => (down ? new Response("nope", { status: 500 }) : undefined));
    mount("/");
    await failed();
    down = false;
    const retry = document.querySelector<HTMLButtonElement>("#retry");
    retry?.focus();
    retry?.click();
    expect(document.activeElement?.id).toBe("main");
  });
});

describe("the sidebar", () => {
  it("starts collapsed, and the toggle widens it and tells assistive technology", async () => {
    await boot();
    expect(toggle()?.hidden).toBe(false);
    expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
    press("#sidebar-toggle");
    expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
    press("#sidebar-toggle");
    expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the name of each dashboard in its link while collapsed", async () => {
    await boot();
    const link = document.querySelector('#sidebar a[aria-current="page"]');
    expect(link?.textContent?.trim()).toBe("Waitlist");
  });

  it("collapses on Escape and hands focus back to the toggle", async () => {
    await boot();
    press("#sidebar-toggle");
    document.querySelector<HTMLElement>("#sidebar a")?.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle());
  });

  it("stays open on an Escape from the page when it sits beside the page", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await boot();
    press("#sidebar-toggle");
    document.querySelector<HTMLElement>("#search")?.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement?.id).toBe("search");
  });

  it("collapses when focus leaves the sidebar while it covers the page", async () => {
    await boot();
    press("#sidebar-toggle");
    document.querySelector<HTMLElement>("#sidebar a")?.focus();
    document.querySelector<HTMLElement>("#refresh")?.focus();
    expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the refresh controls", () => {
  it("reads nothing again while auto refresh is off", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await boot();
    vi.advanceTimersByTime(180_000);
    expect(asked).toEqual(LOAD);
    expect(document.querySelector("#auto-refresh")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("reads the counts again at once when Refresh is pressed, and leaves the rows", async () => {
    await boot();
    press("#refresh");
    await vi.waitFor(() => expect(asked).toEqual([...LOAD, "/api/summary"]));
    expect(document.querySelectorAll("#rows tr")).toHaveLength(1);
  });

  it("with auto refresh on, counts down and reads the counts again at zero", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await boot();
    press("#auto-refresh");
    expect(document.querySelector("#auto-refresh")?.getAttribute("aria-pressed")).toBe("true");
    vi.advanceTimersByTime(1000);
    expect(document.querySelector("#auto-refresh-left")?.textContent).toBe("59s");
    vi.advanceTimersByTime(59_000);
    await vi.waitFor(() => expect(asked).toEqual([...LOAD, "/api/summary"]));
    await vi.waitFor(() =>
      expect(document.querySelector("#auto-refresh-left")?.textContent).toBe("60s"),
    );
  });

  it("stops the countdown when auto refresh is turned off again", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await boot();
    press("#auto-refresh");
    press("#auto-refresh");
    vi.advanceTimersByTime(120_000);
    expect([asked, document.querySelector("#auto-refresh-left")?.textContent]).toEqual([LOAD, ""]);
  });

  it("names a way to recover when a refresh fails", async () => {
    let down = false;
    serve((path) =>
      down && path === "/api/summary" ? new Response("nope", { status: 500 }) : undefined,
    );
    mount("/");
    await vi.waitFor(() => expect(document.querySelectorAll("#rows tr")).toHaveLength(1));
    down = true;
    press("#refresh");
    expect(await failed()).toMatch(/try again/i);
    down = false;
    press("#retry");
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>("#error")?.hidden).toBe(true),
    );
    expect(asked).toEqual([...LOAD, "/api/summary", "/api/summary"]);
  });
});
