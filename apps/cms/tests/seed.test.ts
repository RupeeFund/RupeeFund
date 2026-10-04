import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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

  it("gives a post a title, an excerpt, a cover image and a body", () => {
    expect(fieldsOf("posts")).toEqual([
      "title:string",
      "excerpt:text",
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
});
