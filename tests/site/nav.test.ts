import { describe, expect, it } from "vitest";
import { read, styles } from "./dist.ts";

const header = (page: string): string => {
  const html = read(page);
  return html.slice(html.indexOf("<header"), html.indexOf("</header>"));
};

describe("header", () => {
  it("offers the signup link on every page but the form itself, where it offers a way back", () => {
    expect(header("people.html")).toContain('href="/subscribe"');
    expect(header("subscribe.html")).not.toContain('href="/subscribe"');
    expect(header("subscribe.html")).toContain('aria-label="Back to home"');
  });

  it("starts the header signup button compact on home only, where the hero button shows", () => {
    expect(header("index.html")).toMatch(/<a [^>]*data-header-cta[^>]*data-compact/);
    expect(header("people.html")).not.toContain("data-compact");
  });

  it("grows the link line only for a pointer that can hover", () => {
    expect(styles()).toMatch(
      /@media \(hover: ?hover\) ?\{\s*:is\(\.nav-link, ?\.foot-link, ?\.inline-link\):hover/,
    );
  });

  it("cross-fades between pages only when the reader allows motion", () => {
    expect(styles()).toMatch(
      /@media \(prefers-reduced-motion: ?no-preference\) ?\{\s*@view-transition ?\{\s*navigation: ?auto/,
    );
  });
});
