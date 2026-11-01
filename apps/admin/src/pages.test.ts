import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSETS, FAVICON, STYLESHEET } from "../.generated/assets.ts";
import { waitlistPage } from "./view-waitlist.ts";

const MARKUP_SINKS = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval("];

const SOURCE_CSS = readFileSync("src/admin.css", "utf8");

const VIEW = waitlistPage();

describe("the waitlist page", () => {
  it("writes every value through textContent, so free text can carry no markup", () => {
    for (const sink of MARKUP_SINKS) {
      expect(VIEW).not.toContain(sink);
    }
  });

  it("holds no row data, so the page itself leaks nothing", () => {
    expect(VIEW).not.toMatch(/[\w.]+@[\w.]+/);
  });

  it("loads no host beyond this one", () => {
    expect(VIEW).not.toContain("//");
  });

  it("opens and closes exactly one inline script", () => {
    expect(VIEW.split("<script>")).toHaveLength(2);
    expect(VIEW.split("</script>")).toHaveLength(2);
  });

  it("keeps itself out of a search index", () => {
    expect(VIEW).toContain('content="noindex, nofollow"');
  });

  it("names itself in the title and in one h1", () => {
    expect(VIEW).toContain("<title>Waitlist — The Rupee Fund</title>");
    expect(VIEW.split("<h1")).toHaveLength(2);
  });

  it("puts the page in a landmark the skip link can reach", () => {
    expect(VIEW).toContain('<a class="skip" href="#main">');
    expect(VIEW).toMatch(/<main [^>]*id="main" tabindex="-1"/);
  });

  it("announces a failure to assistive technology without waiting to be found", () => {
    expect(VIEW).toContain('id="error" class="alert" role="alert"');
  });

  it("hides every decorative icon from the accessibility tree", () => {
    for (const tag of VIEW.match(/<svg[^>]*>/g) ?? []) {
      expect(tag).toContain('aria-hidden="true"');
    }
  });

  it("styles itself from the one served stylesheet, with no inline style", () => {
    expect(VIEW).toContain(`<link rel="stylesheet" href="${STYLESHEET}">`);
    expect(VIEW).toContain(`<link rel="icon" type="image/svg+xml" href="${FAVICON}">`);
    expect(ASSETS[STYLESHEET]).toBeDefined();
    expect(VIEW).not.toContain("<style");
    expect(VIEW).not.toContain(" style=");
  });

  it("carries one sprite that every icon reference resolves against", () => {
    expect(VIEW).toContain('<svg class="sprite" id="sprite"');
    for (const ref of VIEW.match(/href="#i-([a-z]+)"/g) ?? []) {
      const name = ref.slice('href="#i-'.length, -1);
      expect(VIEW).toContain(`<symbol id="i-${name}"`);
    }
  });

  it("shows its numbers, records and questions in that order", () => {
    const order = ["numbers-title", "records-title", "questions-title"].map((id) =>
      VIEW.indexOf(`id="${id}"`),
    );
    expect(order.every((at, i) => at > (order[i - 1] ?? 0))).toBe(true);
  });

  it("opens with a header that holds the brand mark and a sign-out link to Access", () => {
    const header = VIEW.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain('alt="The Rupee Fund"');
    expect(header).toContain('href="/cdn-cgi/access/logout"');
    expect(header).toContain("Sign out</a>");
  });

  it("ships no sprite symbol that the page does not ask for", () => {
    const symbols = [...VIEW.matchAll(/<symbol id="i-([a-z]+)"/g)].map((hit) => hit[1]);
    const asked = (name: string) =>
      VIEW.includes(`#i-${name}"`) ||
      VIEW.includes(`use("${name}"`) ||
      VIEW.includes(`: "${name}"`);
    expect(symbols.filter((name) => !asked(name!))).toEqual([]);
  });

  it("takes every colour from a brand token, never from a literal", () => {
    expect(SOURCE_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("names each table itself, not only the section around it", () => {
    for (const name of ["records", "questions"]) {
      expect(VIEW).toMatch(new RegExp(`<table [^>]*aria-labelledby="${name}-title"`));
    }
  });
});
