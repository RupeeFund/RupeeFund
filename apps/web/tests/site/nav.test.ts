import { describe, expect, it } from "vitest";
import { headerOf, styles } from "./dist.ts";

describe("header", () => {
  it("offers the signup link on every page but the form itself, where it offers a way back", () => {
    expect(headerOf("people.html")).toContain('href="/subscribe"');
    expect(headerOf("subscribe.html")).not.toContain('href="/subscribe"');
    expect(headerOf("subscribe.html")).toContain('aria-label="Back to home"');
  });

  it("starts the header signup button compact on home only, where the hero button shows", () => {
    expect(headerOf("index.html")).toMatch(/<a [^>]*data-header-cta[^>]*data-compact/);
    expect(headerOf("people.html")).not.toContain("data-compact");
  });

  it("grows the link line only for a pointer that can hover", () => {
    expect(styles()).toMatch(
      /@media \(hover: ?hover\) ?\{\s*:is\(\.nav-link, ?\.foot-link, ?\.list-link, ?\.inline-link\):hover/,
    );
  });

  it("cross-fades between pages only when the reader allows motion", () => {
    expect(styles()).toMatch(
      /@media \(prefers-reduced-motion: ?no-preference\) ?\{\s*@view-transition ?\{\s*navigation: ?auto/,
    );
  });
});
