import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContentDb, type ContentDb } from "./fixtures/content-db.ts";
import {
  activeUser,
  isLegalPage,
  isPublishedMedia,
  revisionTarget,
  taxonomyCoversGuarded,
  termCoversGuarded,
  usesGuardedMedia,
} from "../src/lib/guard-store.ts";

let db: ContentDb;

const query: ContentDb["query"] = (sql, params) => db.query(sql, params);

const run: ContentDb["run"] = (sql, ...params) => db.run(sql, ...params);

const idOf = (slug: string): string =>
  db.rows<{ id: string }>("SELECT id FROM ec_pages WHERE slug = ?", slug)[0]!.id;

beforeAll(() => {
  db = seedContentDb();
}, 60_000);

afterAll(() => db.close());

describe("isLegalPage", () => {
  it("finds a legal page by its slug or its ID", async () => {
    const id = idOf("terms");
    expect(await isLegalPage(query, "terms")).toBe(true);
    expect(await isLegalPage(query, id)).toBe(true);
  });

  it("finds a page whose draft makes it legal", async () => {
    run("UPDATE ec_pages SET kind = 'page' WHERE slug = 'refunds'");
    run(
      `INSERT INTO revisions (id, collection, entry_id, data)
       SELECT 'rev-legal', 'pages', id, ? FROM ec_pages WHERE slug = 'refunds'`,
      JSON.stringify({ title: "Refunds", kind: "legal" }),
    );
    run("UPDATE ec_pages SET draft_revision_id = 'rev-legal' WHERE slug = 'refunds'");
    expect(await isLegalPage(query, "refunds")).toBe(true);
  });

  it("finds a trashed legal page", async () => {
    run("UPDATE ec_pages SET deleted_at = datetime('now') WHERE slug = 'privacy'");
    expect(await isLegalPage(query, "privacy")).toBe(true);
  });

  it("passes a plain page and a missing one", async () => {
    run(
      "UPDATE ec_pages SET kind = 'page', draft_revision_id = NULL WHERE slug = 'code-of-conduct'",
    );
    expect(await isLegalPage(query, "code-of-conduct")).toBe(false);
    expect(await isLegalPage(query, "no-such-page")).toBe(false);
  });
});

describe("revisionTarget", () => {
  it("names the entry that a revision belongs to", async () => {
    const id = idOf("refunds");
    expect(await revisionTarget(query, "rev-legal")).toEqual({
      collection: "pages",
      entry: id,
      legal: true,
    });
    expect(await revisionTarget(query, "no-such-revision")).toBeNull();
  });
});

describe("isPublishedMedia", () => {
  it("finds an image that a published post uses", async () => {
    expect(await isPublishedMedia(query, "01M42CODE00000000000000000.jpg")).toBe(true);
  });

  it("refuses an image that only a draft uses", async () => {
    expect(await isPublishedMedia(query, "01M42DRAFT0000000000000000.jpg")).toBe(false);
  });

  it("refuses an image that a deleted post uses", async () => {
    run(
      "UPDATE ec_posts SET deleted_at = datetime('now') WHERE featured_image LIKE '%01M42COINS%'",
    );
    expect(await isPublishedMedia(query, "01M42COINS0000000000000000.jpg")).toBe(false);
  });

  it("finds an image that published content holds only by its media ID", async () => {
    run(
      `INSERT INTO media (id, filename, mime_type, storage_key)
       VALUES ('01MEDIAONLYID000000000000', 'b.jpg', 'image/jpeg',
               '01M42BYID0000000000000000.jpg')`,
    );
    run(
      `UPDATE ec_posts SET featured_image = '{"id":"01MEDIAONLYID000000000000","provider":"local"}'
       WHERE slug = (SELECT slug FROM ec_posts WHERE status = 'published' LIMIT 1)`,
    );
    expect(await isPublishedMedia(query, "01M42BYID0000000000000000.jpg")).toBe(true);
  });

  it("finds a published image whose key is longer than a D1 pattern allows", async () => {
    const key = `01M42LONG0000000000000000.${"x".repeat(40)}`;
    run(
      `UPDATE ec_posts SET content = ?
       WHERE slug = (SELECT slug FROM ec_posts WHERE status = 'published' LIMIT 1 OFFSET 1)`,
      JSON.stringify([{ src: `/media/${key}` }]),
    );
    expect(await isPublishedMedia(query, key)).toBe(true);
  });

  it("reads the underscore in a key as a letter, not as any character", async () => {
    expect(await isPublishedMedia(query, "01M42CODE0000000000000000_.jpg")).toBe(false);
  });
});

describe("isPublishedMedia in a link field", () => {
  it("finds an image that a published person links to", async () => {
    run(
      `UPDATE ec_people SET photo_url = '/media/01M42LINK0000000000000000.jpg'
       WHERE id = (SELECT id FROM ec_people WHERE status = 'published' LIMIT 1)`,
    );
    expect(await isPublishedMedia(query, "01M42LINK0000000000000000.jpg")).toBe(true);
  });
});

describe("usesGuardedMedia", () => {
  const media = (id: string, key: string) =>
    run(
      "INSERT INTO media (id, filename, mime_type, storage_key) VALUES (?, ?, 'image/jpeg', ?)",
      id,
      key,
      key,
    );

  beforeAll(() => {
    media("m-legal", "01M42LEGP0000000000000000.jpg");
    media("m-legal-draft", "01M42LEGL0000000000000000.jpg");
    media("m-post", "01M42POST0000000000000000.jpg");
    run(
      "UPDATE ec_pages SET content = ? WHERE slug = 'privacy'",
      '[{"src":"/_emdash/api/media/file/01M42LEGP0000000000000000.jpg"}]',
    );
    run(
      "UPDATE revisions SET data = ? WHERE id = 'rev-legal'",
      JSON.stringify({ kind: "legal", content: [{ key: "01M42LEGL0000000000000000.jpg" }] }),
    );
  });

  it("finds an image that a legal page uses", async () => {
    expect(await usesGuardedMedia(query, "m-legal")).toBe(true);
  });

  it("finds an image that only the draft of a legal page uses", async () => {
    expect(await usesGuardedMedia(query, "m-legal-draft")).toBe(true);
  });

  it("passes an image that no guarded entry uses, and a missing item", async () => {
    expect(await usesGuardedMedia(query, "m-post")).toBe(false);
    expect(await usesGuardedMedia(query, "m-none")).toBe(false);
  });
});

describe("taxonomyCoversGuarded", () => {
  it("knows a taxonomy that covers only posts", async () => {
    expect(await taxonomyCoversGuarded(query, "category")).toBe(false);
  });
});

describe("termCoversGuarded", () => {
  it("knows when a term can tag a guarded collection", async () => {
    run(
      "INSERT INTO taxonomies (id, name, slug, label) VALUES ('t-cat', 'category', 'misc', 'Misc')",
    );
    expect(await termCoversGuarded(query, "t-cat")).toBe(false);
    run(
      `UPDATE _emdash_taxonomy_defs SET collections = '["posts","pages"]' WHERE name = 'category'`,
    );
    expect(await termCoversGuarded(query, "t-cat")).toBe(true);
    expect(await termCoversGuarded(query, "t-none")).toBe(false);
  });
});

describe("activeUser", () => {
  it("knows a user who is not disabled", async () => {
    run("INSERT INTO users (id, email, role) VALUES ('u-on', 'on@example.com', 40)");
    run("INSERT INTO users (id, email, role, disabled) VALUES ('u-off', 'off@example.com', 40, 1)");
    expect(await activeUser(query, "u-on")).toBe(true);
    expect(await activeUser(query, "u-off")).toBe(false);
    expect(await activeUser(query, "u-none")).toBe(false);
  });
});
