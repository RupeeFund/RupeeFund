import { getEmDashCollection, getEmDashEntry, getMenu } from "emdash";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./entries.fixture.json";
import { ContentError } from "./entries.ts";
import { landingContent, menu, page, pages, post, posts } from "./load.ts";

vi.mock("emdash", () => ({
  getEmDashCollection: vi.fn(),
  getEmDashEntry: vi.fn(),
  getMenu: vi.fn(),
}));

const collection = vi.mocked(getEmDashCollection);
const single = vi.mocked(getEmDashEntry);
const named = vi.mocked(getMenu);

type Batch = Awaited<ReturnType<typeof getEmDashCollection>>;
type Found = Awaited<ReturnType<typeof getEmDashEntry>>;
type Menu = Awaited<ReturnType<typeof getMenu>>;

const batch = (entries: unknown[], nextCursor?: string) =>
  ({ entries, ...(nextCursor ? { nextCursor } : {}) }) as unknown as Batch;

const found = (entry: unknown) => ({ entry, isPreview: false }) as unknown as Found;

const links = (items: { label: string; url: string }[]) =>
  ({
    items: items.map((item, index) => ({ id: `${index}`, children: [], ...item })),
  }) as unknown as Menu;

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

describe("a singleton", () => {
  it("reads the entry with its slug", async () => {
    single.mockResolvedValueOnce(found(fresh().landing[0]));
    expect((await landingContent()).heroLede).toContain("UPI");
    expect(single).toHaveBeenCalledWith("landing", "landing");
    expect(collection).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("uses the first published entry, and logs it, when no entry has its slug", async () => {
    const [home] = fresh().landing;
    const other = { ...structuredClone(home!), id: "other", slug: "other" };
    other.data.hero_lede = "The second entry.";
    single.mockResolvedValueOnce(found(null));
    collection.mockResolvedValueOnce(batch([home, other]));
    expect((await landingContent()).heroLede).toContain("UPI");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("The site shows home."));
  });

  it("fails when nothing is published", async () => {
    single.mockResolvedValueOnce(found(null));
    collection.mockResolvedValueOnce(batch([]));
    await expect(landingContent()).rejects.toThrow(ContentError);
  });
});

describe("a menu", () => {
  it("gives each item as a link", async () => {
    named.mockResolvedValueOnce(links([{ label: "Blog", url: "/blog" }]));
    expect(await menu("primary")).toEqual([{ label: "Blog", href: "/blog" }]);
  });

  it("is empty when nobody made it", async () => {
    named.mockResolvedValueOnce(null);
    expect(await menu("footer")).toEqual([]);
  });

  it("leaves out a link that the site does not allow", async () => {
    named.mockResolvedValueOnce(
      links([
        { label: "Plain", url: "http://example.com" },
        { label: "Phone", url: "tel:123" },
        { label: "FAQ", url: "/faq" },
      ]),
    );
    expect(await menu("footer")).toEqual([{ label: "FAQ", href: "/faq" }]);
  });

  it("is empty, and logged, when EmDash cannot read it, so each page still renders", async () => {
    named.mockRejectedValueOnce(new Error("D1 is down"));
    expect(await menu("primary")).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("D1 is down"));
  });
});
