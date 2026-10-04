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

  it("keeps the caption of an image inside the text", () => {
    const input = collections();
    const content = (input.posts[0]!.data as { content: Record<string, unknown>[] }).content;
    content[1]!.caption = "Photo: A. Person, Unsplash";
    const body = buildDocument(input).posts[0]?.body ?? [];
    expect(body.find((block) => block._type === "image")).toMatchObject({
      caption: "Photo: A. Person, Unsplash",
    });
  });

  it.each([
    ["iframe", "embed"],
    ["htmlBlock", "raw HTML"],
    ["gallery", "gallery"],
    ["reference", "reference"],
  ])("refuses a %s block and names it", (type, name) => {
    const input = collections();
    const content = (input.posts[0]!.data as { content: Record<string, unknown>[] }).content;
    content.push({ _type: type, _key: "z" });
    expect(() => buildDocument(input)).toThrow(`posts/${input.posts[0]!.slug}: remove the ${name}`);
  });

  it("gives a post its kind, season, authors and updated date", () => {
    const input = collections();
    Object.assign(input.posts[0]!.data, {
      kind: "Essay",
      season: "Monsoon",
      season_year: 2026,
      updatedAt: "2026-10-03T10:00:00.000Z",
      bylines: [{ byline: { displayName: "Asha Rao" } }, { byline: { displayName: "Ravi Iyer" } }],
    });
    expect(buildDocument(input).posts[0]).toMatchObject({
      kind: "Essay",
      season: { name: "Monsoon", year: 2026 },
      authors: ["Asha Rao", "Ravi Iyer"],
      updatedAt: "2026-10-03T10:00:00.000Z",
    });
  });

  it("takes the season year from the publish date when the editor leaves it out", () => {
    const input = collections();
    Object.assign(input.posts[0]!.data, { season: "Winter" });
    expect(buildDocument(input).posts[0]?.season).toEqual({ name: "Winter", year: 2026 });
  });

  it("keeps the caption of a cover image", () => {
    const input = collections();
    const image = (input.posts[0]!.data as { featured_image: { meta: Record<string, unknown> } })
      .featured_image;
    image.meta.caption = "Photo: A. Person, Unsplash";
    expect(buildDocument(input).posts[0]?.image?.caption).toBe("Photo: A. Person, Unsplash");
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
