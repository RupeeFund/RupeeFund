import { describe, expect, it } from "vitest";
import { blogPaths, sitemapXml } from "./sitemap.ts";

describe("the sitemap", () => {
  const xml = sitemapXml(
    ["/", "/faq", "/privacy", "/waitlist-confirmed", "/404"].map((path) => ({ path })),
  );

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
  const hello = { slug: "hello", publishedAt: "2026-10-01T10:00:00.000Z" };
  const again = { ...hello, slug: "again", updatedAt: "2026-10-05T10:00:00.000Z" };

  it("lists the blog and each post, dated by its last change", () => {
    expect(blogPaths([hello, again])).toEqual([
      { path: "/blog" },
      { path: "/blog/hello", lastmod: "2026-10-01T10:00:00.000Z" },
      { path: "/blog/again", lastmod: "2026-10-05T10:00:00.000Z" },
    ]);
  });

  it("leaves out the blog when no post is published", () => {
    expect(blogPaths([])).toEqual([]);
  });

  it("writes the date of a dated page", () => {
    expect(sitemapXml([{ path: "/blog/hello", lastmod: hello.publishedAt }])).toContain(
      "<loc>https://rupeefund.org/blog/hello</loc><lastmod>2026-10-01T10:00:00.000Z</lastmod>",
    );
  });
});
