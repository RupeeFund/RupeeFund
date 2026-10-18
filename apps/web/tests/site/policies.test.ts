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

  it("names the fund opening, not a launch, on the privacy, terms and refunds pages", () => {
    const launched = ["privacy", "terms", "refunds"].filter((slug) =>
      /launch/i.test(read(`${slug}.html`)),
    );
    expect(launched).toEqual([]);
  });

  it("names Cloudflare Web Analytics under its own heading on the privacy page", () => {
    const html = read("privacy.html");
    const before = html.slice(0, html.indexOf("Cloudflare Web Analytics"));
    const headings = [...before.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map(([, text]) => text);
    expect(headings.at(-1)).toBe("Analytics");
  });

  it("serves each legal page the footer links to", () => {
    const legal = PAGES.filter((page) => page.kind === "legal").map((page) => page.slug);
    expect(legal).toEqual(
      expect.arrayContaining(["privacy", "terms", "refunds", "code-of-conduct"]),
    );
  });
});
