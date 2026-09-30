import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSETS, FAVICON, STYLESHEET } from "../.generated/assets.ts";
import { PAGES } from "./chrome.ts";
import { render } from "./pages.ts";

const MARKUP_SINKS = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval("];

const SOURCE_CSS = readFileSync("src/admin.css", "utf8");

const RENDERED = PAGES.map((entry) => ({ ...entry, html: render(entry.href) }));

describe.each(RENDERED)("the $label page", ({ href, label, html }) => {
  it("writes every value through textContent, so free text can carry no markup", () => {
    for (const sink of MARKUP_SINKS) {
      expect(html).not.toContain(sink);
    }
  });

  it("holds no row data, so the page itself leaks nothing", () => {
    expect(html).not.toMatch(/[\w.]+@[\w.]+/);
  });

  it("loads no host beyond this one", () => {
    expect(html).not.toContain("//");
  });

  it("opens and closes exactly one inline script", () => {
    expect(html.split("<script>")).toHaveLength(2);
    expect(html.split("</script>")).toHaveLength(2);
  });

  it("keeps itself out of a search index", () => {
    expect(html).toContain('content="noindex, nofollow"');
  });

  it("names itself in the title and in one h1", () => {
    expect(html).toContain(`<title>${label} — The Rupee Fund</title>`);
    expect(html.split("<h1")).toHaveLength(2);
  });

  it("puts the dashboard in a landmark the skip link can reach", () => {
    expect(html).toContain('<a class="skip" href="#main">');
    expect(html).toMatch(/<main [^>]*id="main" tabindex="-1"/);
  });

  it("announces a failure to assistive technology without waiting to be found", () => {
    expect(html).toContain('id="error" class="alert" role="alert"');
  });

  it("marks itself as the current page, and marks no other", () => {
    const marked = html.match(/href="([^"]+)" aria-current="page"/g) ?? [];
    expect(marked).toHaveLength(2);
    for (const hit of marked) expect(hit).toContain(`href="${href}"`);
  });

  it("links every nav item to a real address, never to a fragment", () => {
    for (const other of PAGES) {
      expect(html).toContain(`href="${other.href}"`);
    }
    expect(html).not.toMatch(/<a href="#(?!main)/);
  });

  it("hides every decorative icon from the accessibility tree", () => {
    for (const tag of html.match(/<svg[^>]*>/g) ?? []) {
      expect(tag).toContain('aria-hidden="true"');
    }
  });

  it("styles itself from the one served stylesheet, with no inline style", () => {
    expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET}">`);
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${FAVICON}">`);
    expect(ASSETS[STYLESHEET]).toBeDefined();
    expect(html).not.toContain("<style");
    expect(html).not.toContain(" style=");
  });

  it("carries one sprite that every icon reference resolves against", () => {
    expect(html).toContain('<svg class="sprite" id="sprite"');
    for (const ref of html.match(/href="#i-([a-z]+)"/g) ?? []) {
      const name = ref.slice('href="#i-'.length, -1);
      expect(html).toContain(`<symbol id="i-${name}"`);
    }
  });
});

describe("the chrome", () => {
  it("offers one destination for each thing the panel can show", () => {
    expect(PAGES.map((entry) => entry.href)).toEqual(["/", "/records", "/questions"]);
  });

  it("ships no sprite symbol that no page asks for", () => {
    const every = PAGES.map((entry) => render(entry.href));
    const symbols = [...every[0].matchAll(/<symbol id="i-([a-z]+)"/g)].map((hit) => hit[1]);
    const asked = (name: string) =>
      every.some(
        (html) =>
          html.includes(`#i-${name}"`) ||
          html.includes(`use("${name}"`) ||
          html.includes(`: "${name}"`),
      );
    expect(symbols.filter((name) => !asked(name))).toEqual([]);
  });

  it("puts the record dialog only on the page that opens records", () => {
    expect(render("/")).not.toContain('id="record-dialog"');
    expect(render("/questions")).not.toContain('id="record-dialog"');
    expect(render("/records")).toContain('id="record-dialog"');
  });

  it("carries one count in the nav, because one function writes every count slot", () => {
    expect(PAGES.filter((entry) => entry.count)).toHaveLength(1);
  });

  it("takes every colour from a brand token, never from a literal", () => {
    expect(SOURCE_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("wraps a long question instead of cutting it off", () => {
    const rule = SOURCE_CSS.match(/\.question-body \{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("overflow-wrap: anywhere");
    expect(rule).toContain("white-space: pre-wrap");
    expect(rule).not.toContain("text-overflow");
  });

  it("says plainly that a question page holds the words a person wrote", () => {
    expect(render("/questions")).toMatch(
      /Each card holds the words one person wrote on the signup\s+form/,
    );
  });

  it("styles the current page with the attribute the nav actually sets", () => {
    expect(SOURCE_CSS).toContain('.nav-link[aria-current="page"]');
    expect(render("/")).not.toContain('aria-current="location"');
  });

  it("stacks the wide table into cards instead of scrolling it sideways", () => {
    expect(render("/records")).toContain('class="records card');
    expect(SOURCE_CSS).toContain("container: records / inline-size");
    expect(SOURCE_CSS).toContain("@container records (max-width: 760px)");
    expect(SOURCE_CSS).toContain("content: attr(data-label)");
  });

  it("names the table itself, not only the section around it", () => {
    expect(render("/records")).toContain(
      '<table class="records-table" aria-labelledby="records-title">',
    );
  });

  it("says plainly that the filters reach only the loaded records", () => {
    expect(render("/records")).toMatch(
      /Filters run in your browser over\s+the records already loaded/,
    );
  });
});
