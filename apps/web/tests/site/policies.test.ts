import { describe, expect, it } from "vitest";
import { PAGES } from "../fixtures/content.ts";
import { read } from "./dist.ts";

describe("the content pages", () => {
  for (const page of PAGES) {
    it(`renders ${page.slug} from the content manager with its title and effective date`, () => {
      const html = read(`${page.slug}.html`);
      expect(html).toContain(`<h1 class="page-title text-ink mb-4">${page.title}</h1>`);
      expect(html).toContain(`Effective date: ${page.effectiveDate}.</p>`);
    });
  }

  it("serves each legal page the footer links to", () => {
    const legal = PAGES.filter((page) => page.kind === "legal").map((page) => page.slug);
    expect(legal).toEqual(
      expect.arrayContaining(["privacy", "terms", "refunds", "code-of-conduct"]),
    );
  });
});
