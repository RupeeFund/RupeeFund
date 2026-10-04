import { describe, expect, it } from "vitest";
import { contentDocument, isSafeHref } from "../src/schema.ts";
import { validDocument } from "./fixture.ts";

const parse = (doc: unknown) => contentDocument.safeParse(doc);

describe("a safe link", () => {
  it.each(["https://fossunited.org", "mailto:rupeefund@fossunited.org", "/privacy", "#top"])(
    "permits %s",
    (href) => expect(isSafeHref(href)).toBe(true),
  );

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,x",
    "//evil.example",
    "/\\evil.example",
    "http://plain.example",
    " javascript:alert(1)",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://\u0000evil.example",
  ])("refuses %j", (href) => expect(isSafeHref(href)).toBe(false));
});

describe("the content document", () => {
  it("accepts a complete document", () => {
    expect(parse(validDocument()).success).toBe(true);
  });

  it("refuses a document with no FAQ, so an empty answer cannot blank the site", () => {
    expect(parse({ ...validDocument(), faq: [] }).success).toBe(false);
  });

  it("refuses a policy that is published twice", () => {
    const doc = validDocument();
    doc.policies.push({ ...doc.policies[0]!, title: "Second privacy" });
    expect(parse(doc).success).toBe(false);
  });

  it.each(["posts", "faq", "people"] as const)("refuses two %s entries with one slug", (name) => {
    const doc = validDocument();
    (doc[name] as unknown[]).push({ ...doc[name][0]! });
    expect(parse(doc).error?.message).toContain("Give each entry its own slug");
  });

  it("refuses a title that holds only spaces", () => {
    const doc = validDocument();
    doc.posts[0]!.title = "   ";
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a heading or a list where the page expects a plain paragraph", () => {
    const heading = validDocument();
    heading.home.pitchBody = [{ ...heading.home.pitchBody[0]!, style: "h2" }] as never;
    const list = validDocument();
    list.peoplePage.foundationBody = [
      { ...list.peoplePage.foundationBody[0]!, listItem: "bullet" },
    ] as never;
    expect(parse(heading).success).toBe(false);
    expect(parse(list).success).toBe(false);
  });

  it("refuses two paragraphs in a step, because the page shows one", () => {
    const doc = validDocument();
    doc.home.steps[0]!.body = [...doc.home.steps[0]!.body, ...doc.home.steps[0]!.body];
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a team photo address that is not a URL, with a schema message", () => {
    const doc = validDocument();
    doc.people[0]!.photoUrl = "https://";
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a document that misses a policy", () => {
    const doc = validDocument();
    expect(parse({ ...doc, policies: doc.policies.slice(1) }).success).toBe(false);
  });

  it("accepts every block the editor makes that the site can show", () => {
    const doc = validDocument();
    const span = (text: string, marks: string[] = []) => ({ _type: "span", text, marks });
    doc.posts[0]!.body = [
      ...["h1", "h2", "h3", "h4", "h5", "h6"].map((style) => ({
        _type: "block",
        style,
        markDefs: [],
        children: [span("Heading", ["subscript", "superscript"])],
      })),
      { _type: "image", src: "/media/01ABC.png", alt: "A box", caption: "Photo" },
      { _type: "code", language: "ts", code: "let x = 1;" },
      { _type: "break", style: "lineBreak" },
      {
        _type: "table",
        hasHeaderRow: true,
        markDefs: [],
        rows: [{ _type: "tableRow", cells: [{ _type: "tableCell", content: [span("A")] }] }],
      },
    ] as never;
    expect(parse(doc).success).toBe(true);
  });

  it.each(["iframe", "htmlBlock"])("refuses a %s block", (type) => {
    const doc = validDocument();
    doc.posts[0]!.body = [{ _type: type, src: "https://example.org" }] as never;
    const result = parse(doc);
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("does not show embeds or raw HTML");
  });

  const cellWithLink = (href: string) => ({
    _type: "table",
    markDefs: [],
    rows: [
      {
        _type: "tableRow",
        cells: [
          {
            _type: "tableCell",
            colspan: 2,
            markDefs: [{ _key: "l", _type: "link", href }],
            content: [{ _type: "span", text: "x", marks: ["l"] }],
          },
        ],
      },
    ],
  });

  it("keeps the links and spans of a table cell", () => {
    const doc = validDocument();
    doc.posts[0]!.body = [cellWithLink("/faq")] as never;
    expect(contentDocument.parse(doc).posts[0]?.body[0]).toMatchObject({
      rows: [{ cells: [{ colspan: 2, markDefs: [{ href: "/faq" }] }] }],
    });
  });

  it("refuses a script link in the defs of a table cell", () => {
    const doc = validDocument();
    doc.posts[0]!.body = [cellWithLink("javascript:alert(1)")] as never;
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a script link in a table cell", () => {
    const doc = validDocument();
    doc.posts[0]!.body = [
      {
        _type: "table",
        markDefs: [{ _key: "l", _type: "link", href: "javascript:alert(1)" }],
        rows: [
          {
            _type: "tableRow",
            cells: [{ _type: "tableCell", content: [{ _type: "span", text: "x", marks: ["l"] }] }],
          },
        ],
      },
    ] as never;
    expect(parse(doc).success).toBe(false);
  });

  it("gives a post the kind Update when the editor sets none", () => {
    const parsed = contentDocument.parse(validDocument());
    expect(parsed.posts[0]?.kind).toBe("Update");
    expect(parsed.posts[0]?.authors).toEqual([]);
  });

  it("refuses a season the fund does not run", () => {
    const doc = validDocument();
    doc.posts[0]!.season = { name: "Spring", year: 2026 } as never;
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a script link in a Portable Text answer", () => {
    const doc = validDocument();
    doc.faq[0]!.answer = [
      {
        _type: "block",
        style: "normal",
        markDefs: [{ _key: "l", _type: "link", href: "javascript:alert(1)" }],
        children: [{ _type: "span", text: "x", marks: ["l"] }],
      },
    ];
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a script link in a source, outside Portable Text", () => {
    const doc = validDocument();
    doc.faq[0]!.sources = [{ title: "x", url: "javascript:alert(1)" }];
    expect(parse(doc).success).toBe(false);
  });

  it("refuses an image that the site does not serve itself", () => {
    const doc = validDocument();
    doc.posts[0]!.image = { src: "https://cdn.example/x.png", alt: "" };
    expect(parse(doc).success).toBe(false);
  });

  it("refuses an image that can carry a script, such as an SVG", () => {
    const doc = validDocument();
    doc.posts[0]!.image = { src: "/media/01ABC.svg", alt: "" };
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a slug that is not a plain path segment", () => {
    const doc = validDocument();
    doc.posts[0]!.slug = "../x";
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a team photo on a host the site policy does not allow", () => {
    const doc = validDocument();
    doc.people[0]!.photoUrl = "https://cdn.example/me.png";
    expect(parse(doc).success).toBe(false);
  });

  it("refuses a mark that is neither a decorator nor a link", () => {
    const doc = validDocument();
    doc.faq[0]!.answer = [
      {
        _type: "block",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", text: "x", marks: ["missing"] }],
      },
    ];
    expect(parse(doc).success).toBe(false);
  });
});
