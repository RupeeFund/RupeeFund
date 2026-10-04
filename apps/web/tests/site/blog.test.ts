import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUT, read } from "./dist.ts";

describe("the blog", () => {
  it("lists each post with a link to its page", () => {
    expect(read("blog.html")).toMatch(
      /<a href="\/blog\/test-post"[^>]*>\s*\[TEST\] Every block\s*<\/a>/,
    );
  });

  it("lists the posts newest first", () => {
    const slugs = [...read("blog.html").matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(slugs).toEqual(["test-post", "test-long-read", "test-season-notes", "test-short"]);
  });

  it("renders a post with its body, its images and its own canonical", () => {
    const post = read("blog/test-post.html");
    expect(post).toContain(
      'src="/media/01M40TESTLEAD0000000000000.png" alt="A green sample image"',
    );
    expect(post).toContain(
      'src="/media/01M40TESTINLINE00000000000.png" alt="A yellow sample image, 800 by 400"',
    );
    expect(post).toContain('<link rel="canonical" href="https://rupeefund.org/blog/test-post">');
    expect(post).toContain("<title>[TEST] Every block — The Rupee Fund</title>");
    expect(post).toContain(
      '<meta name="description" content="A sample post that shows each block of the blog.">',
    );
  });

  it("renders each block and mark of the body", () => {
    const post = read("blog/test-post.html");
    for (const tag of ["<strong>", "<em>", "<code>", "<h2>", "<h3>", "<h4>", "<blockquote>"]) {
      expect(post).toContain(tag);
    }
    expect(post).toMatch(/<ul><li>A bullet item<\/li>/);
    expect(post).toMatch(
      /<a href="\/people" class="inline-link">a link<\/a><ul><li>A nested bullet item<ul><li>A bullet item three levels deep<\/li><\/ul><\/li>/,
    );
    expect(post).toContain('<span style="text-decoration:underline">underlined</span>');
    expect(post).toContain("<del>struck out</del>");
    expect(post).toContain('<a href="#top" class="inline-link">');
    expect(post).toMatch(/<ol><li>A numbered item<\/li>/);
    expect(post).toContain(
      '<a href="https://fossunited.org" target="_blank" rel="noopener noreferrer"',
    );
    expect(post).toContain('<a href="/faq" class="inline-link">');
    expect(post).toContain('<a href="mailto:hello@example.com" class="inline-link">');
  });

  it("copies each post image into the build", () => {
    for (const file of [
      "01M40TESTLEAD0000000000000.png",
      "01M40TESTINLINE00000000000.png",
      "01M40TESTPORTRAIT000000000.jpg",
      "01M40TESTPANORAMA00000000.webp",
      "01M40TESTSMALL00000000000.png",
    ]) {
      expect(existsSync(`${OUT}/media/${file}`)).toBe(true);
    }
  });

  it("publishes an RSS feed that links each post", () => {
    const feed = read("blog/rss.xml");
    expect(feed).toContain("<link>https://rupeefund.org/blog/test-post</link>");
    expect(feed).toContain("<title>[TEST] Every block</title>");
  });

  it("announces the feed on every page and links the blog from the footer", () => {
    const home = read("index.html");
    expect(home).toContain(
      '<link rel="alternate" type="application/rss+xml" title="The Rupee Fund"' +
        ' href="https://rupeefund.org/blog/rss.xml">',
    );
    expect(home.slice(home.indexOf("<footer"))).toContain('href="/blog"');
  });
});
