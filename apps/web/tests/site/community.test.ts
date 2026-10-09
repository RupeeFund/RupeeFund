import { describe, expect, it } from "vitest";
import { PAGES, headerOf, read } from "./dist.ts";

describe("site metadata and policy links", () => {
  for (const page of PAGES) {
    it(`${page} links to the local policy pages`, () => {
      const html = read(page);
      const footer = html.slice(html.indexOf("<footer"));
      for (const path of ["/terms", "/privacy", "/code-of-conduct"]) {
        expect(footer).toContain(`href="${path}"`);
      }
    });

    it(`${page} carries the header and footer links from the code`, () => {
      const header = headerOf(page);
      const html = read(page);
      const footer = html.slice(html.indexOf("<footer"));
      for (const href of ["/faq", "/people"]) expect(header).toContain(`href="${href}"`);
      for (const href of [
        "/people",
        "https://fossunited.org/team",
        "https://forum.fossunited.org",
        "https://github.com/RupeeFund/RupeeFund",
      ]) {
        expect(footer).toContain(`href="${href}"`);
      }
    });
  }
});
