import { describe, expect, it } from "vitest";
import { read, styles } from "./dist.ts";

describe("active-nav highlight", () => {
  it("marks the current route with aria-current on the home page", () => {
    expect(read("index.html")).toContain('aria-current="page"');
  });

  it("offers the signup link in the header on every page but the form itself", () => {
    const header = (page: string): string => {
      const html = read(page);
      return html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    };
    expect(header("index.html")).toContain('href="/subscribe"');
    expect(header("subscribe.html")).not.toContain('href="/subscribe"');
  });

  it("cross-fades between pages only when the reader allows motion", () => {
    expect(styles()).toMatch(
      /@media \(prefers-reduced-motion: ?no-preference\) ?\{\s*@view-transition ?\{\s*navigation: ?auto/,
    );
  });
});
