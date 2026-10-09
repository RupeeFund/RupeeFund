import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import FaqList from "./FaqList.astro";
import PageBody from "./PageBody.astro";
import PostArticle from "./PostArticle.astro";
import PostList from "./PostList.astro";
import Prose from "./Prose.astro";

const para = (text: string) => [
  {
    _type: "block" as const,
    style: "normal" as const,
    markDefs: [],
    children: [{ _type: "span" as const, text, marks: [] }],
  },
];

const faq = [
  { slug: "a", question: "First?", answer: para("Yes."), order: 1, home: true, sources: [] },
  {
    slug: "b",
    question: "Second?",
    answer: para("No."),
    order: 2,
    home: false,
    sources: [{ title: "FOSS United grants", url: "https://fossunited.org/grants" }],
  },
];

async function render(component: unknown, props: Record<string, unknown>) {
  const container = await AstroContainer.create();
  return container.renderToString(component as never, { props });
}

describe("the shared components", () => {
  it("render Portable Text as the site's HTML", async () => {
    expect(await render(Prose, { blocks: para("Hello <world>") })).toContain(
      "<p>Hello &lt;world&gt;</p>",
    );
  });

  it("list every question, with its sources", async () => {
    const html = await render(FaqList, { faq, contactAddress: "team@example.org" });
    expect(html).toContain("First?");
    expect(html).toContain("Second?");
    expect(html).toContain("Source:");
    expect(html).toContain('href="https://fossunited.org/grants"');
    expect(html).toContain("mailto:team@example.org");
  });

  it("list only the home questions on the home page, and link to the rest", async () => {
    const html = await render(FaqList, { faq, homeOnly: true, contactAddress: "x@example.org" });
    expect(html).toContain("First?");
    expect(html).not.toContain("Second?");
    expect(html).toContain('href="/faq"');
  });

  it("render a legal page with its own effective date", async () => {
    const html = await render(PageBody, {
      page: {
        slug: "terms",
        title: "Terms",
        kind: "legal",
        effectiveDate: "1 October 2026",
        body: para("Rule."),
      },
    });
    expect(html).toContain("Terms");
    expect(html).toContain("Effective date: 1 October 2026.");
    expect(html).toContain("<p>Rule.</p>");
  });

  it("render a page with no effective date", async () => {
    const html = await render(PageBody, {
      page: { slug: "about", title: "About", kind: "page", body: para("Us.") },
    });
    expect(html).not.toContain("Effective date");
    expect(html).toContain("<p>Us.</p>");
  });
});

describe("the blog components", () => {
  const post = {
    slug: "hello",
    title: "Hello",
    excerpt: "First post.",
    image: { src: "/media/01ABC.png", alt: "A red box", width: 8, height: 6 },
    body: para("Body."),
    publishedAt: "2026-10-02T17:40:48.365Z",
    category: "Blog",
    authors: [],
  };

  it("link each post from the list, with its date", async () => {
    const html = await render(PostList, { posts: [post] });
    expect(html).toContain('href="/blog/hello"');
    expect(html).toContain("2 October 2026");
  });

  it("render a post with its cover image and its body", async () => {
    const html = await render(PostArticle, { post });
    expect(html).toContain('src="/media/01ABC.png"');
    expect(html).toContain("<p>Body.</p>");
  });

  it("give a post its category, season, lede, authors, dates and reading time", async () => {
    const words = Array.from({ length: 450 }, () => "word").join(" ");
    const html = await render(PostArticle, {
      post: {
        ...post,
        category: "Article",
        season: { name: "Monsoon", year: 2026 },
        authors: [],
        updatedAt: "2026-10-04T09:00:00.000Z",
        body: para(words),
      },
    });
    expect(html).toContain("Article");
    expect(html).toContain("Monsoon 2026");
    expect(html).toContain('src="/seasons/monsoon.svg"');
    expect(html).toMatch(/class="lede[^"]*"[^>]*>First post\.</);
    expect(html).toContain("The Rupee Fund volunteers");
    expect(html).toMatch(/Updated <time[^>]*>4 October 2026</);
    expect(html).toContain("3 min read");
  });

  it("name the authors and leave out an update on the publish day", async () => {
    const html = await render(PostArticle, {
      post: { ...post, authors: ["Asha Rao", "Ravi Iyer"], updatedAt: post.publishedAt },
    });
    expect(html).toContain("Asha Rao and Ravi Iyer");
    expect(html).not.toContain("Updated");
  });

  it("list three or more authors with commas and a final and", async () => {
    const html = await render(PostArticle, {
      post: { ...post, authors: ["Asha Rao", "Ravi Iyer", "Meera Das"] },
    });
    expect(html).toContain("Asha Rao, Ravi Iyer and Meera Das");
  });

  it("compare the publish and update days in India time", async () => {
    const sameDay = await render(PostArticle, {
      post: {
        ...post,
        publishedAt: "2026-10-02T20:00:00.000Z",
        updatedAt: "2026-10-03T05:00:00.000Z",
      },
    });
    const nextDay = await render(PostArticle, {
      post: {
        ...post,
        publishedAt: "2026-10-02T10:00:00.000Z",
        updatedAt: "2026-10-02T20:00:00.000Z",
      },
    });
    expect(sameDay).not.toContain("Updated");
    expect(nextDay).toMatch(/Updated <time[^>]*>3 October 2026</);
  });

  it("give each row of the list its category and reading time", async () => {
    const html = await render(PostList, { posts: [{ ...post, category: "Guide" }] });
    expect(html).toContain("Guide");
    expect(html).toContain("1 min read");
  });

  it("end a post with two more posts and the signup action", async () => {
    const more = [
      { ...post, slug: "second", title: "Second" },
      { ...post, slug: "third", title: "Third", image: undefined },
    ];
    const html = await render(PostArticle, { post, more });
    expect(html).toContain("Keep reading");
    expect(html).toContain('href="/blog/second"');
    expect(html).toContain('href="/blog/third"');
    expect(html).toContain("Hear when the fund opens");
    expect(html).toContain('href="/subscribe"');
  });

  it("leave out the more posts when there are none", async () => {
    expect(await render(PostArticle, { post })).not.toContain("Keep reading");
  });

  it("show each post's lead image in the list", async () => {
    expect(await render(PostList, { posts: [post] })).toContain('src="/media/01ABC.png"');
  });
});
