import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./entries.fixture.json";
import { ContentError, toFaq, toPage, toPeople, toPost, toPosts, type Entry } from "./entries.ts";

type Collections = Record<keyof typeof fixture, Entry[]>;

const entries = () => structuredClone(fixture) as unknown as Collections;

const hello = () => entries().posts[0]!;

const content = (entry: Entry) => entry.data.content as Record<string, unknown>[];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a post", () => {
  it("points a cover image at the site's own media path", () => {
    expect(toPost(hello()).image).toEqual({
      src: "/media/01M3YV801FWWQQ8HPREHKT37ZD.png",
      alt: "A red box",
      width: 8,
      height: 6,
    });
  });

  it("points an image inside the text at the site's own media path", () => {
    expect(toPost(hello()).body.find((block) => block._type === "image")).toEqual({
      _type: "image",
      src: "/media/01M3YV801FWWQQ8HPREHKT37ZD.png",
      alt: "Inline red box",
      width: 8,
      height: 6,
    });
  });

  it("keeps the caption of an image inside the text and of a cover image", () => {
    const entry = hello();
    content(entry)[1]!.caption = "Photo: A. Person, Unsplash";
    const cover = entry.data.featured_image as { meta: Record<string, unknown> };
    cover.meta.caption = "Photo: B. Person, Unsplash";
    const post = toPost(entry);
    expect(post.body.find((block) => block._type === "image")).toMatchObject({
      caption: "Photo: A. Person, Unsplash",
    });
    expect(post.image?.caption).toBe("Photo: B. Person, Unsplash");
  });

  it.each([
    ["iframe", "embed"],
    ["htmlBlock", "raw HTML"],
    ["gallery", "gallery"],
    ["reference", "reference"],
  ])("refuses a %s block and names it", (type, name) => {
    const entry = hello();
    content(entry).push({ _type: type, _key: "z" });
    expect(() => toPost(entry)).toThrow(`posts/hello: remove the ${name}`);
  });

  it("refuses an image from an outside provider, because the site serves only its own", () => {
    const entry = hello();
    entry.data.featured_image = { id: "x", provider: "unsplash", src: "https://x.example/x.jpg" };
    expect(() => toPost(entry)).toThrow(ContentError);
  });

  it("gives a post its category, season, authors and updated date", () => {
    const entry = hello();
    Object.assign(entry.data, {
      terms: { category: [{ slug: "article", label: "Article" }] },
      season: "Monsoon",
      season_year: 2026,
      updatedAt: new Date("2026-10-03T10:00:00.000Z"),
      bylines: [{ byline: { displayName: "Asha Rao" } }, { byline: { displayName: "Ravi Iyer" } }],
    });
    expect(toPost(entry)).toMatchObject({
      category: "Article",
      season: { name: "Monsoon", year: 2026 },
      authors: ["Asha Rao", "Ravi Iyer"],
      updatedAt: "2026-10-03T10:00:00.000Z",
    });
  });

  it("takes the season year from the publish date when the editor leaves it out", () => {
    const entry = hello();
    Object.assign(entry.data, { season: "Winter" });
    expect(toPost(entry).season).toEqual({ name: "Winter", year: 2026 });
  });

  it("gives a winter post the year that the winter starts in, December", () => {
    const year = (publishedAt: string, name = "Winter") => {
      const entry = hello();
      Object.assign(entry.data, { season: name, publishedAt });
      return toPost(entry).season?.year;
    };
    expect(year("2026-12-20T09:00:00.000Z")).toBe(2026);
    expect(year("2027-02-10T09:00:00.000Z")).toBe(2026);
    expect(year("2027-03-01T09:00:00.000Z", "Summer")).toBe(2027);
  });
});

describe("a list of posts", () => {
  it("shows the newest first", () => {
    const older = hello();
    const newer = structuredClone(older);
    newer.slug = "newer";
    newer.data.publishedAt = "2026-10-09T09:00:00.000Z";
    expect(toPosts([older, newer]).map((post) => post.slug)).toEqual(["newer", "hello"]);
  });

  it("leaves out a post the site cannot show, and keeps the rest", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = structuredClone(hello());
    broken.slug = "broken";
    content(broken).push({ _type: "iframe", _key: "z" });
    expect(toPosts([broken, hello()]).map((post) => post.slug)).toEqual(["hello"]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("posts/broken"));
  });
});

describe("the FAQ and the team", () => {
  it("orders each by its order field", () => {
    const input = entries();
    const first = input.people[0]!;
    input.people.unshift({ slug: "later", data: { ...first.data, title: "Later", order: 9 } });
    expect(toFaq(input.faq).map((q) => q.slug)).toEqual(["voting", "other-funds"]);
    expect(toPeople(input.people).map((p) => p.slug)).toEqual([first.slug, "later"]);
  });

  it("shows entries with the same order oldest first", () => {
    const input = entries();
    for (const entry of input.faq) entry.data.order = 99;
    expect(toFaq(input.faq).map((q) => q.slug)).toEqual(["voting", "other-funds"]);
  });

  it("puts an unordered entry last, oldest first, and numbers each by its place", () => {
    const input = entries();
    const [later, earlier] = input.faq;
    const newest = structuredClone(later!);
    newest.slug = "newest";
    newest.data = { ...newest.data, publishedAt: "2026-10-05T11:40:00.000Z", order: null };
    later!.data.order = "7";
    delete earlier!.data.order;
    input.faq.splice(1, 0, newest);
    expect(toFaq(input.faq).map((q) => [q.slug, q.order])).toEqual([
      [later!.slug, 1],
      [earlier!.slug, 2],
      ["newest", 3],
    ]);
  });

  it("numbers the entries it keeps without a gap", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const input = entries();
    input.faq[0]!.data.title = "";
    expect(toFaq(input.faq).map((q) => q.order)).toEqual([1]);
  });

  it("treats a cleared optional field of a person as empty", () => {
    const input = entries();
    input.people[0]!.data.bio = "";
    expect(toPeople(input.people)[0]?.bio).toBeUndefined();
  });
});

describe("a single entry", () => {
  it("maps a legal page with its effective date", () => {
    const terms = entries().pages.find((entry) => entry.slug === "terms")!;
    expect(toPage(terms)).toMatchObject({ slug: "terms", kind: "legal" });
    expect(toPage(terms).effectiveDate).toBeTruthy();
  });
});
