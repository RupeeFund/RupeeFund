import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDocument, type Collections } from "../src/published.ts";

interface Field {
  slug: string;
  type: string;
  required?: boolean;
}
interface Entry {
  slug: string;
  status: string;
  data: Record<string, unknown>;
}
interface Seed {
  collections: { slug: string; fields: Field[] }[];
  content: Record<string, Entry[]>;
}

const seed = JSON.parse(readFileSync("seed/seed.json", "utf8")) as Seed;

const fieldsOf = (collection: string) =>
  seed.collections.find((c) => c.slug === collection)?.fields.map((f) => `${f.slug}:${f.type}`);

const slugsOf = (collection: string) => (seed.content[collection] ?? []).map((e) => e.slug);

describe("the seed", () => {
  it("models the blog, the FAQ, the designed pages, the people and the policies", () => {
    expect(seed.collections.map((c) => c.slug).sort()).toEqual(
      ["faq", "home", "people", "people_page", "policies", "posts"].sort(),
    );
  });

  it("gives a post a title, an excerpt, its context, a cover image and a body", () => {
    expect(fieldsOf("posts")).toEqual([
      "title:string",
      "excerpt:text",
      "kind:select",
      "season:select",
      "season_year:integer",
      "featured_image:image",
      "content:portableText",
    ]);
  });

  it("carries every FAQ answer the site has today", () => {
    expect(slugsOf("faq")).toHaveLength(14);
    expect(slugsOf("faq")).toContain("voting");
  });

  it("carries the four policies", () => {
    expect(slugsOf("policies").sort()).toEqual(
      ["code-of-conduct", "privacy", "refunds", "terms"].sort(),
    );
  });

  it("carries one entry for each designed page, and the community team", () => {
    expect(slugsOf("home")).toEqual(["home"]);
    expect(slugsOf("people_page")).toEqual(["people"]);
    expect(slugsOf("people").length).toBeGreaterThan(0);
  });

  it("publishes every seeded entry, so the first build has content", () => {
    for (const entries of Object.values(seed.content)) {
      for (const entry of entries) expect(entry.status).toBe("published");
    }
  });

  it("fills every required field of every seeded entry", () => {
    for (const collection of seed.collections) {
      for (const entry of seed.content[collection.slug] ?? []) {
        for (const field of collection.fields.filter((f) => f.required)) {
          expect(
            entry.data[field.slug],
            `${collection.slug}/${entry.slug}.${field.slug}`,
          ).toBeDefined();
        }
      }
    }
  });

  const seedDocument = () =>
    buildDocument(
      Object.fromEntries(
        ["posts", "faq", "home", "people_page", "people", "policies"].map((name) => [
          name,
          (seed.content[name] ?? []).map(({ slug, data }) => ({ slug, data })),
        ]),
      ) as Collections,
    );

  it("builds a site document that the schema accepts", () => {
    expect(() => seedDocument()).not.toThrow();
  });

  it("gives the site the same pages as the fixture, apart from the blog", () => {
    const fixture = JSON.parse(
      readFileSync("../web/tests/fixtures/content/published.json", "utf8"),
    ) as Record<string, unknown>;
    const pages = (document: Record<string, unknown>) => {
      const { posts: _posts, policies, ...rest } = JSON.parse(JSON.stringify(document));
      return { ...rest, policies: Object.fromEntries(policies.map((p: Entry) => [p.slug, p])) };
    };
    expect(pages(seedDocument())).toEqual(pages(fixture));
  });
});
