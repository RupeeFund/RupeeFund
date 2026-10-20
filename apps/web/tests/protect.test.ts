import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContentDb, type ContentDb } from "./fixtures/content-db.ts";
import { TEAM_ROLES } from "@rupeefund/auth";
import { ADMIN_ROLE } from "../src/lib/guard.ts";
import type { Query } from "../src/lib/guard-store.ts";
import { deletesLegalPage, isPublic, refusesWrite, sessionUserId } from "../src/lib/protect.ts";

let db: ContentDb;

const query: Query = (sql, params) => db.query(sql, params);

const broken: Query = async () => {
  throw new Error("D1_ERROR: unavailable");
};

const noTerm = async (): Promise<string | null> => null;

beforeAll(() => {
  db = seedContentDb();
  db.run(
    `INSERT INTO revisions (id, collection, entry_id, data)
     SELECT 'rev-terms', 'pages', id, '{}' FROM ec_pages WHERE slug = 'terms'`,
  );
  db.run(
    `INSERT INTO revisions (id, collection, entry_id, data)
     SELECT 'rev-post', 'posts', id, '{}' FROM ec_posts LIMIT 1`,
  );
  db.run(
    `INSERT INTO revisions (id, collection, entry_id, data)
     SELECT 'rev-faq', 'faq', id, '{}' FROM ec_faq LIMIT 1`,
  );
  db.run("UPDATE ec_pages SET kind = 'page' WHERE slug = 'code-of-conduct'");
  db.run(
    `INSERT INTO revisions (id, collection, entry_id, data)
     SELECT 'rev-was-legal', 'pages', id, '{"kind":"legal"}' FROM ec_pages
     WHERE slug = 'code-of-conduct'`,
  );
  db.run(
    `INSERT INTO media (id, filename, mime_type, storage_key)
     VALUES ('m-land', 'a.jpg', 'image/jpeg', '01M42LAND0000000000000000.jpg')`,
  );
  db.run(
    "UPDATE ec_pages SET content = '[\"01M42LAND0000000000000000.jpg\"]' WHERE slug = 'privacy'",
  );
}, 60_000);

afterAll(() => db.close());

it("gives the admin role to the GitHub admin team", () => {
  expect(TEAM_ROLES["cms-admins"]).toBe(ADMIN_ROLE);
});

describe("refusesWrite", () => {
  it.each([
    ["PUT", "/_emdash/api/content/pages/terms"],
    ["POST", "/_emdash/api/content/pages/terms/restore"],
    ["POST", "/_emdash/api/revisions/rev-terms/restore"],
    ["PUT", "/_emdash/api/media/m-land/replace"],
    ["DELETE", "/_emdash/api/media/m-land"],
    ["DELETE", "/_emdash/api/media/providers/local/m-land"],
    ["POST", "/_emdash/api/revisions/rev-was-legal/restore"],
    ["POST", "/_emdash/api/content/faq"],
    ["PUT", "/_emdash/api/content/faq/why-this-fund"],
    ["POST", "/_emdash/api/content/people/mrugesh/unpublish"],
    ["DELETE", "/_emdash/api/content/people/mrugesh"],
    ["POST", "/_emdash/api/revisions/rev-faq/restore"],
    ["POST", "/_emdash/api/mcp"],
  ])("refuses %s %s", async (method, path) => {
    expect(await refusesWrite(query, method, path, noTerm)).toBe(true);
  });

  it.each([
    ["PUT", "/_emdash/api/content/pages/code-of-conduct"],
    ["POST", "/_emdash/api/content/pages"],
    ["PUT", "/_emdash/api/content/posts/hello"],
    ["POST", "/_emdash/api/revisions/rev-post/restore"],
    ["POST", "/_emdash/api/revisions/rev-none/restore"],
    ["DELETE", "/_emdash/api/media/m-none"],
    ["POST", "/_emdash/api/taxonomies/bulk-tag"],
    ["GET", "/_emdash/api/content/pages/terms"],
  ])("allows %s %s", async (method, path) => {
    expect(await refusesWrite(query, method, path, noTerm)).toBe(false);
  });

  it("reads the term of a bulk tag", async () => {
    db.run("INSERT INTO taxonomies (id, name, slug, label) VALUES ('t-x', 'category', 'x', 'X')");
    db.run(`UPDATE _emdash_taxonomy_defs SET collections = '["pages"]' WHERE name = 'category'`);
    const path = "/_emdash/api/taxonomies/bulk-tag";
    expect(await refusesWrite(query, "POST", path, async () => "t-x")).toBe(true);
  });

  it("refuses a term edit once its taxonomy covers pages", async () => {
    const path = "/_emdash/api/taxonomies/category/terms/x";
    expect(await refusesWrite(query, "DELETE", path, noTerm)).toBe(true);
  });

  it("fails when the content database fails", async () => {
    const write = refusesWrite(broken, "PUT", "/_emdash/api/content/pages/terms", noTerm);
    await expect(write).rejects.toThrow("D1_ERROR");
  });
});

describe("deletesLegalPage", () => {
  it("finds the delete of a legal page", async () => {
    expect(await deletesLegalPage(query, "DELETE", "/_emdash/api/content/pages/terms")).toBe(true);
  });

  it.each([
    ["PUT", "/_emdash/api/content/pages/terms"],
    ["DELETE", "/_emdash/api/content/pages/code-of-conduct"],
    ["DELETE", "/_emdash/api/content/posts/hello"],
    ["DELETE", "/_emdash/api/content/pages/terms/lock"],
    ["DELETE", "/_emdash/api/content/faq/why-this-fund"],
  ])("ignores %s %s", async (method, path) => {
    expect(await deletesLegalPage(query, method, path)).toBe(false);
  });
});

describe("isPublic", () => {
  const stored = async (): Promise<boolean> => true;

  it("knows a published image", async () => {
    expect(await isPublic(query, "01M42CODE00000000000000000.jpg", stored)).toBe(true);
  });

  it("hides every image when the content database fails", async () => {
    expect(await isPublic(broken, "01M42CODE00000000000000000.jpg", stored)).toBe(false);
  });

  it("skips the content database for a file the bucket does not hold", async () => {
    const missing = async (): Promise<boolean> => false;
    let reads = 0;
    const counted: Query = async (sql, params) => {
      reads += 1;
      return query(sql, params);
    };
    expect(await isPublic(counted, "01M42NONE00000000000000000.jpg", missing)).toBe(false);
    expect(reads).toBe(0);
  });
});

describe("sessionUserId", () => {
  const kept: Promise<unknown>[] = [];
  const keepAlive = (pending: Promise<unknown>) => {
    kept.push(pending);
  };

  it("reads the signed-in user", async () => {
    const session = { get: async () => ({ id: "u-1" }) };
    expect(await sessionUserId(session, keepAlive)).toBe("u-1");
  });

  it("has no user without a session, or when the read fails", async () => {
    expect(await sessionUserId(undefined, keepAlive)).toBeNull();
    const failing = { get: async () => Promise.reject(new Error("KV down")) };
    expect(await sessionUserId(failing, keepAlive)).toBeNull();
  });

  it("gives up on a read that never settles, and keeps it alive", async () => {
    const stalled = { get: () => new Promise<unknown>(() => {}) };
    kept.length = 0;
    expect(await sessionUserId(stalled, keepAlive, 10)).toBeNull();
    expect(kept).toHaveLength(1);
  });
});
