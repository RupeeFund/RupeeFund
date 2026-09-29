import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUT, PAGES, read } from "./dist.ts";

describe("sitemap", () => {
  it("generates the sitemap index", () => {
    expect(existsSync(`${OUT}/sitemap-index.xml`)).toBe(true);
  });

  it("excludes every route the sitemap filter names", () => {
    const xml = read("sitemap-0.xml");
    for (const slug of ["404", "waitlist-confirmed", "waitlist-problem"]) {
      expect(xml).not.toContain(`rupeefund.org/${slug}`);
    }
  });

  it("lists the public pages", () => {
    const xml = read("sitemap-0.xml");
    expect(xml.match(/<loc>/g)).toHaveLength(7);
    for (const path of [
      "/privacy",
      "/refunds",
      "/subscribe",
      "/people",
      "/terms",
      "/code-of-conduct",
    ]) {
      expect(xml, `sitemap is missing ${path}`).toContain(`https://rupeefund.org${path}`);
    }
  });
});

describe("robots.txt", () => {
  it("points at the generated sitemap index", () => {
    expect(read("robots.txt")).toContain("Sitemap: https://rupeefund.org/sitemap-index.xml");
  });

  it("permits crawlers, because the one deployed site is the public one", () => {
    expect(read("robots.txt")).toContain("Allow: /");
    expect(read("robots.txt")).not.toContain("Disallow: /");
  });
});

describe("_headers", () => {
  const headers = read("_headers");

  it("carries no sitewide noindex, which would hide rupeefund.org from every engine", () => {
    expect(headers).not.toContain("X-Robots-Tag");
  });

  it("caches hashed assets immutably", () => {
    expect(headers).toContain("/_astro/*");
    expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
  });

  it("sets HSTS", () => {
    expect(headers).toContain("Strict-Transport-Security");
  });
});

describe("head metadata", () => {
  const html = read("index.html");

  it("emits Organization JSON-LD", () => {
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Organization"');
  });

  it("emits WebSite JSON-LD on the home page, which Google reads for the site name", () => {
    expect(html).toContain(
      '{"@context":"https://schema.org","@type":"WebSite","name":"The Rupee Fund","url":"https://rupeefund.org"}',
    );
  });

  it("emits WebSite JSON-LD on no other page", () => {
    for (const page of PAGES.filter((p) => p !== "index.html")) {
      expect(read(page), `${page} must not carry WebSite JSON-LD`).not.toContain(
        '"@type":"WebSite"',
      );
    }
  });

  it("names the site for link previews on every page", () => {
    for (const page of PAGES) {
      expect(read(page), `${page} is missing og:site_name`).toContain(
        '<meta property="og:site_name" content="The Rupee Fund">',
      );
    }
  });

  it("emits an apple-touch-icon", () => {
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it("links the web manifest", () => {
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest">');
  });

  it("emits Open Graph and Twitter card tags", () => {
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
  });
});
