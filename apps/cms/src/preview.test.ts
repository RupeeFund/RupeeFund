import { describe, expect, it } from "vitest";
import fixture from "../tests/fixtures/published-entries.json";
import { previewDocument } from "./preview.ts";
import type { Collections, Entry } from "./published.ts";

const collections = () => structuredClone(fixture) as unknown as Collections;

const draftOf = (entry: Entry, data: Record<string, unknown>): Entry => ({
  slug: entry.slug,
  data: { ...structuredClone(entry.data), ...data },
});

describe("the preview document", () => {
  it("shows the draft in place of the published entry", () => {
    const [post] = collections().posts;
    const doc = previewDocument(collections(), "posts", draftOf(post!, { title: "Draft title" }));
    expect(doc.posts.map((p) => p.title)).toEqual(["Draft title"]);
  });

  it("adds a draft that has never been published, dated now", () => {
    const [post] = collections().posts;
    const draft = draftOf(post!, { id: "NEW", publishedAt: null, title: "New" });
    draft.slug = "new";
    const doc = previewDocument(collections(), "posts", draft);
    expect(doc.posts.map((p) => p.slug)).toEqual(["hello", "new"]);
    expect(Date.parse(doc.posts[1]!.publishedAt)).not.toBeNaN();
  });

  it("replaces a single page with its draft", () => {
    const [home] = collections().home;
    const doc = previewDocument(collections(), "home", draftOf(home!, { hero_lede: "Draft lede" }));
    expect(doc.home.heroLede).toBe("Draft lede");
  });

  it("points each image at the signed-in media path, so a new draft image loads", () => {
    const [post] = collections().posts;
    const doc = previewDocument(collections(), "posts", draftOf(post!, {}));
    expect(doc.posts[0]?.image?.src).toBe("/preview/media/01M3YV801FWWQQ8HPREHKT37ZD.png");
  });

  it("leaves text that names the media path as it is", () => {
    const [post] = collections().posts;
    const body = [
      { _type: "block", markDefs: [], children: [{ _type: "span", text: "/media/x", marks: [] }] },
    ];
    const doc = previewDocument(collections(), "posts", draftOf(post!, { content: body }));
    expect(JSON.stringify(doc.posts[0]?.body)).toContain('"text":"/media/x"');
  });
});
