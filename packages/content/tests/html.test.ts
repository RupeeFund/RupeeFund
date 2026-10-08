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

describe("the editor blocks", () => {
  const span = (text: string, marks: string[] = []) => ({ _type: "span" as const, text, marks });
  const block = (style: string, text: string) =>
    ({ _type: "block", style, markDefs: [], children: [span(text)] }) as PortableText[number];

  it("shows a top heading as a section heading, because the post title is the h1", () => {
    expect(toHtml([block("h1", "Top")])).toBe("<h2>Top</h2>");
  });

  it("renders the small headings", () => {
    expect(toHtml([block("h5", "Five"), block("h6", "Six")])).toBe("<h5>Five</h5><h6>Six</h6>");
  });

  it("renders subscript and superscript", () => {
    const html = toHtml([
      {
        _type: "block",
        style: "normal",
        markDefs: [],
        children: [span("H"), span("2", ["subscript"]), span("O"), span("1", ["superscript"])],
      },
    ]);
    expect(html).toBe("<p>H<sub>2</sub>O<sup>1</sup></p>");
  });

  it("renders a table with its header row, spans, marks and cell links", () => {
    const html = toHtml([
      {
        _type: "table",
        hasHeaderRow: true,
        markDefs: [],
        rows: [
          {
            _type: "tableRow",
            cells: [{ _type: "tableCell", isHeader: true, colspan: 2, content: [span("Item")] }],
          },
          {
            _type: "tableRow",
            cells: [
              {
                _type: "tableCell",
                markDefs: [{ _key: "l", _type: "link", href: "/faq" }],
                content: [span("FAQ", ["l", "strong"])],
              },
              { _type: "tableCell", content: [span("Help")] },
            ],
          },
        ],
      },
    ]);
    expect(html).toBe(
      '<div class="table-wrap"><table><thead><tr><th scope="col" colspan="2">Item</th></tr>' +
        '</thead><tbody><tr><td><a href="/faq" class="inline-link"><strong>FAQ</strong></a></td>' +
        "<td>Help</td></tr>" +
        "</tbody></table></div>",
    );
  });

  it("renders a code block as escaped text with its language", () => {
    expect(toHtml([{ _type: "code", language: "html", code: "<b>x</b>" }])).toBe(
      '<pre data-language="html"><code>&lt;b&gt;x&lt;/b&gt;</code></pre>',
    );
  });

  it("keeps the indent of code as plain spaces", () => {
    expect(toHtml([{ _type: "code", code: "if x:\n    y = 1" }])).toBe(
      "<pre><code>if x:\n    y = 1</code></pre>",
    );
  });

  it("renders a divider", () => {
    expect(toHtml([{ _type: "break", style: "lineBreak" }])).toBe("<hr>");
  });

  it("renders an image with its caption as a figure", () => {
    expect(
      toHtml([{ _type: "image", src: "/media/01ABC.png", alt: "A box", caption: "Photo: <A>" }]),
    ).toBe(
      '<figure><img src="/media/01ABC.png" alt="A box" loading="lazy" decoding="async">' +
        "<figcaption>Photo: &lt;A&gt;</figcaption></figure>",
    );
  });
});

describe("the post building blocks", () => {
  it("renders a callout as a note, with its text escaped", () => {
    expect(toHtml([{ _type: "callout", tone: "note", text: "Read <this> first" }])).toBe(
      '<aside class="callout" data-tone="note" role="note"><p>Read &lt;this&gt; first</p></aside>',
    );
  });

  it("renders a highlighted callout", () => {
    expect(toHtml([{ _type: "callout", tone: "highlight", text: "Mind the date" }])).toContain(
      'data-tone="highlight"',
    );
  });

  it("renders a quote with its attribution", () => {
    expect(toHtml([{ _type: "quote", text: "Fund the commons", attribution: "A member" }])).toBe(
      '<figure class="pull-quote"><blockquote><p>Fund the commons</p></blockquote>' +
        "<figcaption>A member</figcaption></figure>",
    );
  });

  it("renders a quote with no attribution", () => {
    expect(toHtml([{ _type: "quote", text: "Fund the commons" }])).toBe(
      '<figure class="pull-quote"><blockquote><p>Fund the commons</p></blockquote></figure>',
    );
  });

  it("renders a call to action as a button link", () => {
    expect(toHtml([{ _type: "cta", label: "Join the list", url: "/subscribe" }])).toBe(
      '<p class="cta"><a href="/subscribe" class="btn btn-primary">Join the list</a></p>',
    );
  });

  it("drops a call to action whose link it does not trust", () => {
    expect(toHtml([{ _type: "cta", label: "Click", url: "javascript:alert(1)" }])).toBe("");
  });
});

describe("the inline renderer", () => {
  it("renders one paragraph without its paragraph tag, for a styled parent", () => {
    expect(toInlineHtml(linked("/privacy"))).toBe(
      'Read <a href="/privacy" class="inline-link"><strong>this</strong></a>',
    );
  });
});
