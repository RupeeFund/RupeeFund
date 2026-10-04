import { mediaKeys } from "@rupeefund/content/media";
import { contentDocument } from "@rupeefund/content/schema";
import { describe, expect, it } from "vitest";
import fixture from "../tests/fixtures/published-entries.json";
import { buildDocument, ContentError, type Collections } from "./published.ts";

const collections = () => structuredClone(fixture) as unknown as Collections;

describe("the published document", () => {
  it("is one the site's schema accepts", () => {
    expect(contentDocument.safeParse(buildDocument(collections())).success).toBe(true);
  });

  it("points a cover image at the site's own media path", () => {
    expect(buildDocument(collections()).posts[0]?.image).toEqual({
      src: "/media/01M3YV801FWWQQ8HPREHKT37ZD.png",
      alt: "A red box",
      width: 8,
      height: 6,
    });
  });

  it("points an image inside the text at the site's own media path", () => {
    const body = buildDocument(collections()).posts[0]?.body ?? [];
    expect(body.find((block) => block._type === "image")).toEqual({
      _type: "image",
      src: "/media/01M3YV801FWWQQ8HPREHKT37ZD.png",
      alt: "Inline red box",
      width: 8,
      height: 6,
    });
  });

  it("orders the FAQ and the team by their order field", () => {
    const input = collections();
    const first = input.people[0]!;
    input.people.unshift({ slug: "later", data: { ...first.data, title: "Later", order: 9 } });
    const doc = buildDocument(input);
    const orders = doc.faq.map((q) => q.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(doc.people.map((p) => p.slug)).toEqual([first.slug, "later"]);
  });

  it("lists every media file the published entries use, so the media route serves no other", () => {
    expect(mediaKeys(buildDocument(collections()))).toEqual(["01M3YV801FWWQQ8HPREHKT37ZD.png"]);
  });

  it("refuses an image from an outside provider, because the site serves only its own", () => {
    const input = collections();
    const data = input.posts[0]!.data as { featured_image: Record<string, unknown> };
    data.featured_image = { id: "x", provider: "unsplash", src: "https://images.example/x.jpg" };
    expect(() => buildDocument(input)).toThrow(ContentError);
  });

  it("refuses a site with no published home page", () => {
    expect(() => buildDocument({ ...collections(), home: [] })).toThrow(ContentError);
  });

  it("treats a cleared optional field of a person as empty", () => {
    const input = collections();
    input.people[0]!.data.bio = "";
    expect(buildDocument(input).people[0]?.bio).toBeUndefined();
  });
});
