import { describe, expect, it } from "vitest";
import { isMediaAsset, isMediaFile, locksSchema, mediaKey, writeTarget } from "./guard.ts";

describe("locksSchema", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("refuses a %s from a browser session", (method) => {
    expect(locksSchema(method, "/_emdash/api/schema/collections", false)).toBe(true);
    expect(locksSchema(method, "/_emdash/api/schema", false)).toBe(true);
  });

  it.each([
    ["POST", "/_emdash/api/relations"],
    ["PATCH", "/_emdash/api/relations/01REL"],
    ["POST", "/_emdash/api/admin/byline-fields"],
    ["POST", "/_emdash/api/admin/byline-fields/reorder"],
    ["DELETE", "/_emdash/api/admin/byline-fields/role"],
    ["POST", "/_emdash/api/taxonomies"],
    ["PUT", "/_emdash/api/taxonomies/category"],
    ["DELETE", "/_emdash/api/taxonomies/category"],
  ])("refuses %s %s from a browser session", (method, path) => {
    expect(locksSchema(method, path, false)).toBe(true);
  });

  it("lets an API token change the schema", () => {
    expect(locksSchema("POST", "/_emdash/api/schema/collections", true)).toBe(false);
    expect(locksSchema("POST", "/_emdash/api/taxonomies", true)).toBe(false);
  });

  it("lets anyone read the schema", () => {
    expect(locksSchema("GET", "/_emdash/api/schema/collections", false)).toBe(false);
    expect(locksSchema("GET", "/_emdash/api/taxonomies/category", false)).toBe(false);
  });

  it.each([
    ["POST", "/_emdash/api/schemax"],
    ["POST", "/_emdash/api/content/posts"],
    ["POST", "/_emdash/api/taxonomies/category/terms"],
    ["PUT", "/_emdash/api/taxonomies/category/terms/blog"],
    ["POST", "/_emdash/api/taxonomies/category/reorder"],
    ["POST", "/_emdash/api/taxonomies/bulk-tag"],
  ])("leaves %s %s to the editors", (method, path) => {
    expect(locksSchema(method, path, false)).toBe(false);
  });
});

describe("writeTarget", () => {
  it.each([
    ["PUT", "/_emdash/api/content/landing/landing", "landing", "landing"],
    ["POST", "/_emdash/api/content/landing", "landing", null],
    ["POST", "/_emdash/api/content/pages/terms/publish", "pages", "terms"],
    ["PUT", "/_emdash/api/content/pages/terms", "pages", "terms"],
    ["POST", "/_emdash/api/content/pages/terms/duplicate", "pages", "terms"],
    ["POST", "/_emdash/api/content/pages/01ABC/terms/category", "pages", "01ABC"],
    ["DELETE", "/_emdash/api/content/pages/terms/schedule", "pages", "terms"],
    ["POST", "/_emdash/api/visual-editing/content/pages/terms/publish", "pages", "terms"],
  ])("finds the entry that %s %s changes", (method, path, collection, entry) => {
    expect(writeTarget(method, path)).toEqual({ kind: "entry", collection, entry });
  });

  it("finds the revision that a restore applies", () => {
    expect(writeTarget("POST", "/_emdash/api/revisions/01REV/restore")).toEqual({
      kind: "revision",
      revision: "01REV",
    });
  });

  it.each([
    ["PUT", "/_emdash/api/media/01MED/replace"],
    ["DELETE", "/_emdash/api/media/01MED"],
    ["DELETE", "/_emdash/api/media/providers/local/01MED"],
  ])("finds the media item that %s %s changes", (method, path) => {
    expect(writeTarget(method, path)).toEqual({ kind: "media", media: "01MED" });
  });

  it.each([
    ["PUT", "/_emdash/api/taxonomies/category/terms/blog"],
    ["DELETE", "/_emdash/api/taxonomies/category/terms/blog"],
    ["POST", "/_emdash/api/taxonomies/category/reorder"],
    ["POST", "/_emdash/api/taxonomies/category/terms/blog/translations"],
  ])("finds the taxonomy whose terms %s %s changes", (method, path) => {
    expect(writeTarget(method, path)).toEqual({ kind: "taxonomy", taxonomy: "category" });
  });

  it("finds a bulk tag", () => {
    expect(writeTarget("POST", "/_emdash/api/taxonomies/bulk-tag")).toEqual({ kind: "terms" });
  });

  it.each([
    ["GET", "/_emdash/api/content/pages/terms"],
    ["POST", "/_emdash/api/content/posts/hello"],
    ["POST", "/_emdash/api/content/pageslist/x"],
    ["GET", "/_emdash/api/revisions/01REV"],
    ["PUT", "/_emdash/api/media/01MED"],
    ["POST", "/_emdash/api/media/01MED/confirm"],
    ["GET", "/_emdash/api/media/01MED"],
    ["POST", "/_emdash/api/taxonomies/category/terms"],
  ])("leaves %s %s alone", (method, path) => {
    expect(writeTarget(method, path)).toBeNull();
  });
});

describe("mediaKey", () => {
  it.each([
    ["/media/01M42CODE00000000000000000.jpg", "01M42CODE00000000000000000.jpg"],
    ["/_emdash/api/media/file/01M42CODE00000000000000000.jpg", "01M42CODE00000000000000000.jpg"],
  ])("reads the stored key of %s", (path, key) => {
    expect(mediaKey(path)).toBe(key);
  });

  it.each(["/media", "/media/", "/_emdash/api/media/file/a/b.jpg", "/blog/x"])(
    "has no key for %s",
    (path) => {
      expect(mediaKey(path)).toBeNull();
    },
  );
});

describe("isMediaFile", () => {
  it.each(["/media/x.jpg", "/media/a/b.jpg", "/_emdash/api/media/file/01J.jpg (1)", "/media"])(
    "gates %s",
    (path) => {
      expect(isMediaFile(path)).toBe(true);
    },
  );

  it.each(["/mediax", "/_emdash/api/media/01MED", "/_emdash/api/media/asset/01MED/a.jpg"])(
    "leaves %s to the other rules",
    (path) => {
      expect(isMediaFile(path)).toBe(false);
    },
  );
});

describe("isMediaAsset", () => {
  it("knows the signed-in download route", () => {
    expect(isMediaAsset("/_emdash/api/media/asset/01MED/a.jpg")).toBe(true);
    expect(isMediaAsset("/_emdash/api/media/file/a.jpg")).toBe(false);
  });
});
