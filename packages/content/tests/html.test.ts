import { describe, expect, it } from "vitest";
import { toHtml, toInlineHtml } from "../src/html.ts";
import type { PortableText } from "../src/schema.ts";

const linked = (href: string): PortableText => [
  {
    _type: "block",
    style: "normal",
    markDefs: [{ _key: "l", _type: "link", href }],
    children: [
      { _type: "span", text: "Read ", marks: [] },
      { _type: "span", text: "this", marks: ["l", "strong"] },
    ],
  },
];

describe("the Portable Text renderer", () => {
  it("renders a paragraph with an inline link in the site style", () => {
    expect(toHtml(linked("/privacy"))).toBe(
      '<p>Read <a href="/privacy" class="inline-link"><strong>this</strong></a></p>',
    );
  });

  it("opens an external link in a new tab, with no opener", () => {
    expect(toHtml(linked("https://fossunited.org"))).toContain(
      'href="https://fossunited.org" target="_blank" rel="noopener noreferrer" class="inline-link"',
    );
  });

  it("drops a link it does not trust, and keeps the text", () => {
    const html = toHtml(linked("javascript:alert(1)"));
    expect(html).not.toContain("javascript");
    expect(html).toContain("this");
  });

  it("escapes text, so typed markup stays text", () => {
    const html = toHtml([
      {
        _type: "block",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", text: "<script>x</script>", marks: [] }],
      },
    ]);
    expect(html).toBe("<p>&lt;script&gt;x&lt;/script&gt;</p>");
  });

  it("renders a bullet list for the prose style", () => {
    const item = (text: string) => ({
      _type: "block" as const,
      style: "normal" as const,
      listItem: "bullet" as const,
      level: 1,
      markDefs: [],
      children: [{ _type: "span" as const, text, marks: [] }],
    });
    expect(toHtml([item("One"), item("Two")])).toBe("<ul><li>One</li><li>Two</li></ul>");
  });

  it("renders an image from the site's own media path", () => {
    expect(
      toHtml([{ _type: "image", src: "/media/01ABC.png", alt: "A red box", width: 8, height: 6 }]),
    ).toBe(
      '<img src="/media/01ABC.png" alt="A red box" width="8" height="6"' +
        ' loading="lazy" decoding="async">',
    );
  });
});

describe("the inline renderer", () => {
  it("renders one paragraph without its paragraph tag, for a styled parent", () => {
    expect(toInlineHtml(linked("/privacy"))).toBe(
      'Read <a href="/privacy" class="inline-link"><strong>this</strong></a>',
    );
  });
});
