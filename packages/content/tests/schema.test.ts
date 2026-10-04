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
  ])("refuses %s", (href) => expect(isSafeHref(href)).toBe(false));
});

describe("the content document", () => {
  it("accepts a complete document", () => {
    expect(parse(validDocument()).success).toBe(true);
  });

  it("refuses a document with no FAQ, so an empty answer cannot blank the site", () => {
    expect(parse({ ...validDocument(), faq: [] }).success).toBe(false);
  });

  it("refuses a document that misses a policy", () => {
    const doc = validDocument();
    expect(parse({ ...doc, policies: doc.policies.slice(1) }).success).toBe(false);
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
