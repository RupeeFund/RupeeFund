import { describe, expect, it } from "vitest";
import { faqEntry, isSafeHref, page, person, post } from "./schema.ts";
import { validFaq, validPage, validPerson, validPost } from "./fixture.ts";

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

const withBody = (body: unknown) => post.safeParse({ ...validPost(), body });

describe("the entry schemas", () => {
  it("accept a complete entry of each collection", () => {
    expect(post.safeParse(validPost()).success).toBe(true);
    expect(faqEntry.safeParse(validFaq()).success).toBe(true);
    expect(person.safeParse(validPerson()).success).toBe(true);
    expect(page.safeParse(validPage()).success).toBe(true);
  });

  it("refuses a title that holds only spaces", () => {
    expect(post.safeParse({ ...validPost(), title: "   " }).success).toBe(false);
  });

  it("refuses a team photo address that is not a URL, with a schema message", () => {
    expect(person.safeParse({ ...validPerson(), photoUrl: "https://" }).success).toBe(false);
  });

  it("accepts every block the editor makes that the site can show", () => {
    const span = (text: string, marks: string[] = []) => ({ _type: "span", text, marks });
    const body = [
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
    ];
    expect(withBody(body).success).toBe(true);
  });

  it("accepts the post building blocks", () => {
    const body = [
      { _type: "callout", _key: "a", id: "x", tone: "highlight", text: "Mind the date" },
      { _type: "quote", text: "Fund the commons", attribution: "A member" },
      { _type: "cta", label: "Join the list", url: "/subscribe" },
    ];
    expect(withBody(body).success).toBe(true);
  });

  it("refuses a call to action with a script link", () => {
    const body = [{ _type: "cta", label: "Click", url: "javascript:alert(1)" }];
    expect(withBody(body).success).toBe(false);
  });

  it("refuses an empty callout", () => {
    expect(withBody([{ _type: "callout", tone: "note", text: "  " }]).success).toBe(false);
  });

  it.each(["iframe", "htmlBlock"])("refuses a %s block", (type) => {
    const result = withBody([{ _type: type, src: "https://example.org" }]);
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
    expect(withBody([cellWithLink("/faq")]).data?.body[0]).toMatchObject({
      rows: [{ cells: [{ colspan: 2, markDefs: [{ href: "/faq" }] }] }],
    });
  });

  it("refuses a script link in the defs of a table cell", () => {
    expect(withBody([cellWithLink("javascript:alert(1)")]).success).toBe(false);
  });

  it("refuses a script link in a table cell", () => {
    const body = [
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
    ];
    expect(withBody(body).success).toBe(false);
  });

  it("gives a post the category Blog and no authors when the editor sets none", () => {
    const parsed = post.parse(validPost());
    expect(parsed.category).toBe("Blog");
    expect(parsed.authors).toEqual([]);
  });

  it("refuses a season the fund does not run", () => {
    const season = { name: "Spring", year: 2026 };
    expect(post.safeParse({ ...validPost(), season }).success).toBe(false);
  });

  it("refuses a script link in a Portable Text answer", () => {
    const answer = [
      {
        _type: "block",
        style: "normal",
        markDefs: [{ _key: "l", _type: "link", href: "javascript:alert(1)" }],
        children: [{ _type: "span", text: "x", marks: ["l"] }],
      },
    ];
    expect(faqEntry.safeParse({ ...validFaq(), answer }).success).toBe(false);
  });

  it("refuses a script link in a source, outside Portable Text", () => {
    const sources = [{ title: "x", url: "javascript:alert(1)" }];
    expect(faqEntry.safeParse({ ...validFaq(), sources }).success).toBe(false);
  });

  it("refuses an image that the site does not serve itself", () => {
    const image = { src: "https://cdn.example/x.png", alt: "" };
    expect(post.safeParse({ ...validPost(), image }).success).toBe(false);
  });

  it("refuses an image that can carry a script, such as an SVG", () => {
    const image = { src: "/media/01ABC.svg", alt: "" };
    expect(post.safeParse({ ...validPost(), image }).success).toBe(false);
  });

  it("refuses a slug that is not a plain path segment", () => {
    expect(post.safeParse({ ...validPost(), slug: "../x" }).success).toBe(false);
  });

  it("refuses a team photo on a host the site policy does not allow", () => {
    const photoUrl = "https://cdn.example/me.png";
    expect(person.safeParse({ ...validPerson(), photoUrl }).success).toBe(false);
  });

  it("refuses a mark that is neither a decorator nor a link", () => {
    const answer = [
      {
        _type: "block",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", text: "x", marks: ["missing"] }],
      },
    ];
    expect(faqEntry.safeParse({ ...validFaq(), answer }).success).toBe(false);
  });

  it("makes a page a plain page when the editor sets no kind", () => {
    const { slug, title, body } = validPage();
    expect(page.parse({ slug, title, body }).kind).toBe("page");
  });

  it("refuses a page kind the site does not know", () => {
    expect(page.safeParse({ ...validPage(), kind: "news" }).success).toBe(false);
  });
});
