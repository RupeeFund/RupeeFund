import { getEmDashCollection, getEmDashEntry } from "emdash";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./entries.fixture.json";
import { page, pages, post, posts } from "./load.ts";

vi.mock("emdash", () => ({
  getEmDashCollection: vi.fn(),
  getEmDashEntry: vi.fn(),
}));

const collection = vi.mocked(getEmDashCollection);
const single = vi.mocked(getEmDashEntry);

type Batch = Awaited<ReturnType<typeof getEmDashCollection>>;
type Found = Awaited<ReturnType<typeof getEmDashEntry>>;

const batch = (entries: unknown[], nextCursor?: string) =>
  ({ entries, ...(nextCursor ? { nextCursor } : {}) }) as unknown as Batch;

const found = (entry: unknown) => ({ entry, isPreview: false }) as unknown as Found;

const fresh = () => structuredClone(fixture);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("a published list", () => {
  it("reads every batch until EmDash gives no cursor", async () => {
    const all = fresh().pages;
    collection.mockResolvedValueOnce(batch(all.slice(0, 2), "next"));
    collection.mockResolvedValueOnce(batch(all.slice(2)));
    expect((await pages()).map(({ slug }) => slug)).toEqual(all.map(({ slug }) => slug));
    expect(collection).toHaveBeenCalledTimes(2);
    expect(collection).toHaveBeenNthCalledWith(1, "pages", {
      status: "published",
      limit: 100,
      cursor: undefined,
    });
    expect(collection).toHaveBeenNthCalledWith(2, "pages", {
      status: "published",
      limit: 100,
      cursor: "next",
    });
  });

  it("fails when EmDash cannot read the collection", async () => {
    collection.mockResolvedValueOnce({
      entries: fresh().posts,
      error: new Error("D1 is down"),
    } as unknown as Batch);
    await expect(posts()).rejects.toThrow("D1 is down");
  });
});

describe("a single entry", () => {
  it("reads a page by its slug", async () => {
    single.mockResolvedValueOnce(found(fresh().pages[0]));
    expect((await page("code-of-conduct"))?.title).toBe("Code of conduct");
    expect(single).toHaveBeenCalledWith("pages", "code-of-conduct");
  });

  it.each(["01M3YV8MFB0Y431NEWY1A79T44", "", "Hello"])(
    "does not look up %j, which is not a slug",
    async (slug) => {
      expect(await post(slug)).toBeNull();
      expect(single).not.toHaveBeenCalled();
    },
  );

  it("is missing when EmDash has no published entry", async () => {
    single.mockResolvedValueOnce(found(null));
    expect(await post("draft")).toBeNull();
  });

  it("is missing, and logged, when the site refuses the entry", async () => {
    const hello = fresh().posts[0]!;
    hello.data.title = "";
    single.mockResolvedValueOnce(found(hello));
    expect(await post("hello")).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("hello"));
  });

  it("fails when EmDash cannot read the entry", async () => {
    single.mockResolvedValueOnce({
      entry: fresh().pages[0],
      error: new Error("D1 is down"),
    } as unknown as Found);
    await expect(page("terms")).rejects.toThrow("D1 is down");
  });
});
