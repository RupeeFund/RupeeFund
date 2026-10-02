import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSETS, FAVICON, STYLESHEET } from "../.generated/assets.ts";
import { DASHBOARDS } from "./chrome.ts";
import { render } from "./pages.ts";

const MARKUP_SINKS = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval("];

const SOURCE_CSS = readFileSync("src/admin.css", "utf8");

const RENDERED = DASHBOARDS.map((entry) => ({ ...entry, html: render(entry.href) }));
const VIEW = render("/");

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

  it("marks itself as the current dashboard, and marks no other", () => {
    const marked = html.match(/href="([^"]+)" aria-current="page"/g) ?? [];
    expect(marked).toEqual([`href="${href}" aria-current="page"`]);
  });

  it("links every sidebar item to a real address, never to a fragment", () => {
    for (const other of DASHBOARDS) {
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
  it("offers one dashboard today, the waitlist, with its numbers, records and questions", () => {
    expect(DASHBOARDS.map((entry) => entry.href)).toEqual(["/"]);
    const order = ["numbers-title", "records-title", "questions-title"].map((id) =>
      VIEW.indexOf(`id="${id}"`),
    );
    expect(order.every((at, i) => at > (order[i - 1] ?? 0))).toBe(true);
  });

  it("ends the sidebar with a sign-out link to Cloudflare Access", () => {
    const sidebar = VIEW.match(/<nav class="sidebar"[\s\S]*?<\/nav>/)?.[0] ?? "";
    const links = sidebar.match(/<a [^>]*href="[^"]+"/g) ?? [];
    expect(links.at(-1)).toContain('href="/cdn-cgi/access/logout"');
    expect(sidebar).toContain(">Sign out</span>");
  });

  it("starts with the sidebar collapsed, its toggle hidden until the script runs", () => {
    const toggle = VIEW.match(/<button[^>]*id="sidebar-toggle"[^>]*>/)?.[0] ?? "";
    expect(toggle).toContain('aria-expanded="false"');
    expect(toggle).toContain('aria-controls="sidebar"');
    expect(toggle).toMatch(/ hidden[ >]/);
  });

  it("ships no sprite symbol that no page asks for", () => {
    const every = DASHBOARDS.map((entry) => render(entry.href));
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

  it("takes every colour from a brand token, never from a literal", () => {
    expect(SOURCE_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("wraps a long question instead of cutting it off", () => {
    const rule = SOURCE_CSS.match(/\.question-body \{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("overflow-wrap: anywhere");
    expect(rule).toContain("white-space: pre-wrap");
    expect(rule).not.toContain("text-overflow");
  });

  it("styles the current dashboard and the open sidebar from the attributes they set", () => {
    expect(SOURCE_CSS).toContain('.sidebar-link[aria-current="page"]');
    expect(SOURCE_CSS).toContain('#sidebar-toggle[aria-expanded="true"]');
    expect(VIEW).not.toContain('aria-current="location"');
  });

  it("stacks each wide table into cards instead of scrolling it sideways", () => {
    for (const name of ["records", "questions"]) {
      expect(VIEW).toContain(`class="${name} card`);
      expect(SOURCE_CSS).toContain(`container: ${name} / inline-size`);
      expect(SOURCE_CSS).toMatch(
        new RegExp(`@container ${name} \\((max-width: |width <= )\\d+px\\)`),
      );
    }
    expect(SOURCE_CSS).toContain("content: attr(data-label)");
  });

  it("spreads the figures over more equal columns as the numbers card widens", () => {
    expect(VIEW).toContain('class="numbers card');
    expect(SOURCE_CSS).toContain("container: numbers / inline-size");
    expect(SOURCE_CSS).toMatch(/@container numbers \(width >= \d+px\) \{\s+\.figures/);
  });

  it("shows a status as an icon and a word, with no pill around it", () => {
    const rules = SOURCE_CSS.match(/\.status-mark[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.join("")).not.toMatch(/\bbg-|rounded|shadow|\bpx-|\bpy-/);
  });

  it("names each table itself, not only the section around it", () => {
    for (const name of ["records", "questions"]) {
      expect(VIEW).toMatch(new RegExp(`<table [^>]*aria-labelledby="${name}-title"`));
    }
  });
});
