import { describe, expect, it } from "vitest";
import { read, styles } from "./dist.ts";

describe("Home page (/)", () => {
  it("builds the hero logo from the synced brand file, so the motion finds its three parts", () => {
    const html = read("index.html");
    const start = html.indexOf('<div class="hero-lockup');
    const lockup = html.slice(start, html.indexOf("</svg>", start));
    expect(lockup).toContain('aria-hidden="true"');
    expect(lockup).not.toContain("<title>");
    const css = styles();
    for (const part of ["block", "rupee", "wordmark"]) {
      expect(lockup).toContain(`id="${part}"`);
      expect(css).toContain(`.hero-lockup #${part}`);
    }
  });

  it("raises the wordmark one letter at a time, as the brand site does", () => {
    const html = read("index.html");
    const start = html.indexOf('<g id="wordmark"');
    const wordmark = html.slice(start, html.indexOf("</g>", start));
    expect(wordmark.match(/style="--i: \d"/g)).toHaveLength(4);
    expect(styles()).toContain(".hero-lockup #wordmark path");
  });
});
