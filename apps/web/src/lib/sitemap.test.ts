import { describe, expect, it } from "vitest";
import { blogPaths, sitemapXml } from "./sitemap.ts";

describe("the sitemap", () => {
  const xml = sitemapXml(["/", "/faq", "/privacy", "/waitlist-confirmed", "/404"]);

  it("lists each public page at its canonical address", () => {
    expect(xml).toContain("<loc>https://rupeefund.org</loc>");
    expect(xml).toContain("<loc>https://rupeefund.org/faq</loc>");
    expect(xml).toContain("<loc>https://rupeefund.org/privacy</loc>");
  });

  it("leaves out each page that the SEO table keeps out of the search index", () => {
    expect(xml).not.toContain("/waitlist-confirmed");
    expect(xml).not.toContain("/404");
  });

  it("is a sitemap document", () => {
    const [declaration, urlset] = xml.split("\n");
    expect(declaration).toBe('<?xml version="1.0" encoding="UTF-8"?>');
    expect(urlset).toMatch(/^<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    expect(xml.match(/<url>/g)).toHaveLength(3);
  });
});

describe("the blog in the sitemap", () => {
  it("lists the blog and each post when one post or more is published", () => {
    expect(blogPaths(["hello", "again"])).toEqual(["/blog", "/blog/hello", "/blog/again"]);
  });

  it("leaves out the blog when no post is published", () => {
    expect(blogPaths([])).toEqual([]);
  });
});
