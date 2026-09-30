import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

describe("site metadata and policy links", () => {
  for (const page of PAGES) {
    it(`${page} links to the local policy pages`, () => {
      const html = read(page);
      const footer = html.slice(html.indexOf("<footer"));
      for (const path of ["/terms", "/privacy", "/code-of-conduct"]) {
        expect(footer).toContain(`href="${path}"`);
      }
    });
  }
});
