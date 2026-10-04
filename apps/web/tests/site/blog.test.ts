import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUT, read, styles } from "./dist.ts";

describe("the blog", () => {
  it("lists each post with a link to its page", () => {
    expect(read("blog.html")).toMatch(
      /<a href="\/blog\/how-to-write-a-post-for-this-blog"[^>]*>\s*How to write a post for this blog\s*<\/a>/,
    );
  });

  it("turns a post title green on hover, with no growing line", () => {
    expect(read("blog.html")).toContain('class="row-link');
    expect(styles()).toMatch(
      /@media \(hover: ?hover\) ?\{\s*\.row-link:hover ?\{\s*color: ?var\(--color-brand-fg\)/,
    );
    expect(styles()).not.toMatch(/\.row-link[^{]*\{[^}]*background-size/);
  });

  it("lists the posts newest first", () => {
    const slugs = [...read("blog.html").matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(slugs).toEqual([
      "how-to-write-a-post-for-this-blog",
      "how-to-be-a-good-open-source-contributor",
      "how-open-source-gets-funded-today",
      "small-steady-funding-for-indian-open-source",
    ]);
  });

  it("renders a post with its context, its images and its own canonical", () => {
    const post = read("blog/how-to-write-a-post-for-this-blog.html");
    expect(post).toContain(
      'src="/media/01M42HTML00000000000000000.jpg" alt="Close-up of HTML code on a screen"',
    );
    expect(post).toContain("Photo: Dominik Malinowski, Unsplash");
    expect(post).toContain("The Rupee Fund volunteers");
    expect(post).toContain(
      '<link rel="canonical" href="https://rupeefund.org/blog/how-to-write-a-post-for-this-blog">',
    );
    expect(post).toContain("<title>How to write a post for this blog — The Rupee Fund</title>");
    expect(read("blog/how-open-source-gets-funded-today.html")).toContain("Post-monsoon 2026");
  });

  it("renders each block and mark of the body", () => {
    const post = read("blog/how-to-write-a-post-for-this-blog.html");
    for (const tag of ["<strong>", "<em>", "<code>", "<h3>", "<h4>", "<h5>", "<h6>", "<hr>"]) {
      expect(post).toContain(tag);
    }
    expect(post).toContain("<h2>Before you start</h2>");
    expect(post).toContain("<blockquote>");
    expect(post).toContain("<sub>2</sub>");
    expect(post).toContain("<sup>3</sup>");
    expect(post).toContain('<span style="text-decoration:underline">underline</span>');
    expect(post).toContain("<del>strike-through</del>");
    expect(post).toMatch(
      /<li>Facts you checked<ul><li>A figure, with its source linked<ul><li>The date you read the page<\/li><\/ul>/,
    );
    expect(post).toMatch(
      /<ol><li>Draft the post<ol><li>Write the outline<ol><li>List the headings/,
    );
    expect(post).toContain('<th scope="col">Element</th>');
    expect(post).toContain('<pre data-language="md"><code>');
    expect(post).toContain("<figcaption>Every post starts as plain text.");
    expect(post).toContain('<a href="#main" class="inline-link">');
    expect(post).toContain(
      '<a href="https://opensource.guide/how-to-contribute/" target="_blank" rel="noopener noreferrer"',
    );
    expect(post).toContain('<a href="/faq" class="inline-link">');
    expect(post).toContain('<a href="mailto:rupeefund@fossunited.org" class="inline-link">');
  });

  it("copies each post image into the build", () => {
    for (const file of [
      "01M42CODE00000000000000000.jpg",
      "01M42COINS0000000000000000.jpg",
      "01M42GROUP0000000000000000.jpg",
      "01M42HTML00000000000000000.jpg",
      "01M42PAIR00000000000000000.jpg",
      "01M42STAGE0000000000000000.jpg",
      "01M42TEAM00000000000000000.jpg",
    ]) {
      expect(existsSync(`${OUT}/media/${file}`)).toBe(true);
    }
  });

  it("publishes an RSS feed that links each post", () => {
    const feed = read("blog/rss.xml");
    expect(feed).toContain(
      "<link>https://rupeefund.org/blog/how-to-write-a-post-for-this-blog</link>",
    );
    expect(feed).toContain("<title>How to write a post for this blog</title>");
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
