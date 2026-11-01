import { describe, expect, it } from "vitest";
import {
  beforePublish,
  deleteGate,
  publishGate,
  purgePosts,
  saveGate,
  scheduleGate,
  type Store,
} from "./hooks.ts";

const author = { id: "u0", role: 30, source: "api" as const };
const editor = { id: "u1", role: 40, source: "api" as const };
const admin = { id: "u2", role: 50, source: "api" as const };
const api = { source: "api" as const };

function store(
  entries: Record<string, Record<string, unknown>> = {},
  {
    failing = false,
    drafts = {},
  }: {
    failing?: boolean;
    drafts?: Record<string, Record<string, unknown>>;
  } = {},
): Store {
  return {
    async get(collection, id) {
      expect(collection).toBe("pages");
      if (failing) throw new Error("the database is unavailable");
      const data = entries[id];
      return data === undefined ? null : { data, draft: drafts[id] };
    },
  };
}

const rejected = (message: string) =>
  expect.objectContaining({ name: "ContentSaveRejectedError", message });

describe("the save gate", () => {
  it("lets an author save a post", async () => {
    await expect(
      saveGate({ collection: "posts", content: {}, isNew: true, actor: author }, store()),
    ).resolves.toBeUndefined();
  });

  it("refuses a new legal page by an editor", async () => {
    await expect(
      saveGate(
        { collection: "pages", content: { kind: "legal" }, isNew: true, actor: editor },
        store(),
      ),
    ).rejects.toThrow(
      rejected("Only an admin can edit a legal page. Ask an admin for the change."),
    );
  });

  it("refuses an editor who turns a legal page into a plain page", async () => {
    await expect(
      saveGate(
        { collection: "pages", content: { kind: "page" }, isNew: false, id: "p", actor: editor },
        store({ p: { kind: "legal" } }),
      ),
    ).rejects.toThrow(
      rejected("Only an admin can edit a legal page. Ask an admin for the change."),
    );
  });

  it("refuses an editor's page save when the stored page cannot be read", async () => {
    await expect(
      saveGate(
        { collection: "pages", content: {}, isNew: false, id: "p", actor: editor },
        store({}, { failing: true }),
      ),
    ).rejects.toThrow(
      rejected("Only an admin can edit a legal page. Ask an admin for the change."),
    );
  });

  it("lets an editor edit a plain page", async () => {
    await expect(
      saveGate(
        { collection: "pages", content: { title: "About" }, isNew: false, id: "p", actor: editor },
        store({ p: { kind: "page" } }),
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses a save with no actor", async () => {
    await expect(
      saveGate({ collection: "pages", content: { kind: "legal" }, isNew: true }, store()),
    ).rejects.toThrow(
      rejected("Only an admin can edit a legal page. Ask an admin for the change."),
    );
  });

  it("lets an admin edit a legal page", async () => {
    await expect(
      saveGate(
        { collection: "pages", content: { kind: "legal" }, isNew: false, id: "p", actor: admin },
        store({ p: { kind: "legal" } }),
      ),
    ).resolves.toBeUndefined();
  });
});

describe("the publish gate", () => {
  const legal = { id: "p", data: { kind: "legal" } };
  const plain = { id: "p", data: { kind: "page" } };

  it("lets an editor publish a plain page", async () => {
    expect(
      await publishGate(
        { collection: "pages", content: plain, origin: api, actor: editor },
        store({ p: { kind: "page" } }),
      ),
    ).toBeUndefined();
  });

  it("refuses an editor who publishes or unpublishes a legal page, with a reason", async () => {
    expect(
      await publishGate(
        { collection: "pages", content: legal, origin: api, actor: editor },
        store({ p: { kind: "legal" } }),
      ),
    ).toEqual({
      cancel: true,
      reason: "Only an admin can publish or unpublish this entry. Ask an admin for the change.",
    });
  });

  it("refuses an editor who publishes a plain draft over a live legal page", async () => {
    expect(
      await publishGate(
        { collection: "pages", content: plain, origin: api, actor: editor },
        store({ p: { kind: "legal" } }),
      ),
    ).toMatchObject({ cancel: true });
  });

  it("refuses an editor's page publish when the live page cannot be read", async () => {
    expect(
      await publishGate(
        { collection: "pages", content: plain, origin: api, actor: editor },
        store({}, { failing: true }),
      ),
    ).toMatchObject({ cancel: true });
  });

  it("refuses a legal action with no actor", async () => {
    expect(
      await publishGate({ collection: "pages", content: legal, origin: api }, store()),
    ).toMatchObject({ cancel: true });
  });

  it("lets an admin publish a legal page", async () => {
    expect(
      await publishGate(
        { collection: "pages", content: legal, origin: api, actor: admin },
        store({ p: { kind: "legal" } }),
      ),
    ).toBeUndefined();
  });
});

describe("the FAQ and the community team", () => {
  const entry = { id: "e", data: { title: "x" } };
  const adminOnly = "Only an admin can change this. Ask an admin for the change.";

  it.each(["faq", "people"])(
    "refuses an author or an editor who saves to %s",
    async (collection) => {
      for (const actor of [author, editor]) {
        await expect(
          saveGate({ collection, content: {}, isNew: true, actor }, store()),
        ).rejects.toThrow(rejected(adminOnly));
      }
    },
  );

  it.each(["faq", "people"])("refuses an editor who publishes %s", async (collection) => {
    expect(
      await publishGate({ collection, content: entry, origin: api, actor: editor }, store()),
    ).toMatchObject({ cancel: true });
  });

  it.each(["faq", "people"])("lets an admin save, publish and delete %s", async (collection) => {
    await expect(
      saveGate({ collection, content: {}, isNew: false, id: "e", actor: admin }, store()),
    ).resolves.toBeUndefined();
    expect(
      await publishGate({ collection, content: entry, origin: api, actor: admin }, store()),
    ).toBeUndefined();
    expect(await deleteGate({ collection, id: "e" }, store())).toBe(undefined);
  });
});

describe("the save gate on drafts", () => {
  it("refuses an editor's partial edit of a plain page whose draft is legal", async () => {
    await expect(
      saveGate(
        { collection: "pages", content: { title: "x" }, isNew: false, id: "p", actor: editor },
        store({ p: { kind: "page" } }, { drafts: { p: { kind: "legal" } } }),
      ),
    ).rejects.toThrow(
      rejected("Only an admin can edit a legal page. Ask an admin for the change."),
    );
  });
});

describe("the delete gate", () => {
  it("keeps every legal page, because a delete names no actor", async () => {
    expect(
      await deleteGate({ collection: "pages", id: "p" }, store({ p: { kind: "legal" } })),
    ).toBe(false);
  });

  it("keeps a page whose draft is legal", async () => {
    expect(
      await deleteGate(
        { collection: "pages", id: "p" },
        store({ p: { kind: "page" } }, { drafts: { p: { kind: "legal" } } }),
      ),
    ).toBe(false);
  });

  it("keeps a page that cannot be read", async () => {
    expect(await deleteGate({ collection: "pages", id: "p" }, store({}, { failing: true }))).toBe(
      false,
    );
  });

  it("lets a plain page or a post go", async () => {
    expect(await deleteGate({ collection: "pages", id: "p" }, store({ p: { kind: "page" } }))).toBe(
      undefined,
    );
    expect(await deleteGate({ collection: "posts", id: "q" }, store())).toBe(undefined);
  });
});

describe("the schedule gate", () => {
  it("refuses each schedule, because no cron publishes it", () => {
    expect(scheduleGate()).toEqual({
      cancel: true,
      reason: "The content manager does not publish at a set time. Publish the entry now.",
    });
  });
});

describe("the byline purge", () => {
  it("purges each kept page that shows posts, so a new byline name shows", async () => {
    const tags: string[][] = [];
    await purgePosts({ purge: async (options) => void tags.push(options.tags) });
    expect(tags).toEqual([["posts"]]);
  });

  it("does nothing where the edge cache has no purge, as under astro dev", async () => {
    await expect(purgePosts(undefined)).resolves.toBeUndefined();
  });
});

describe("the publish check", () => {
  const text = (body: string, href?: string) => ({
    _type: "block",
    _key: "a",
    style: "normal",
    markDefs: href ? [{ _key: "l", _type: "link", href }] : [],
    children: [{ _type: "span", _key: "b", text: body, marks: href ? ["l"] : [] }],
  });
  const post = (content: unknown[]) => ({
    id: "01P",
    slug: "hello",
    publishedAt: null,
    data: { title: "Hello", excerpt: "A first post", content },
  });
  const faq = (data: Record<string, unknown>) => ({
    id: "01F",
    slug: "why",
    data: { title: "Why?", answer: [text("Because.")], order: 1, home: 1, ...data },
  });
  const publish = (collection: string, content: Record<string, unknown>, actor = author) =>
    beforePublish({ collection, content, origin: api, actor }, store());

  it("lets an author publish a post the site can show, on its first publish", async () => {
    expect(await publish("posts", post([text("Hi")]))).toBeUndefined();
  });

  it("refuses a post with an http link, and names the field as the editor shows it", async () => {
    expect(await publish("posts", post([text("Hi"), text("See", "http://x.example")]))).toEqual({
      cancel: true,
      reason:
        "Fix this before you publish. Body, item 2: Use an https:, mailto: or site-relative link.",
    });
  });

  it("refuses an admin's FAQ entry with an empty question and an http source", async () => {
    const sources = [{ title: "A source", url: "http://x.example" }];
    expect(await publish("faq", faq({ title: " ", sources }), admin)).toEqual({
      cancel: true,
      reason:
        "Fix this before you publish. Question: Fill this in. " +
        "Sources, item 1, URL: Use an https:, mailto: or site-relative link.",
    });
  });

  it("refuses a post with an embed", async () => {
    expect(await publish("posts", post([{ _type: "iframe", _key: "z" }]))).toEqual({
      cancel: true,
      reason: "Fix this before you publish. Remove the embed. The site does not show it.",
    });
  });

  it("gives an editor the admin-only reason first", async () => {
    expect(await publish("faq", faq({ title: "" }), editor)).toEqual({
      cancel: true,
      reason: "Only an admin can publish or unpublish this entry. Ask an admin for the change.",
    });
  });

  it("lets an admin unpublish an entry the site cannot show", async () => {
    expect(
      await publishGate(
        { collection: "faq", content: faq({ title: "" }), origin: api, actor: admin },
        store(),
      ),
    ).toBeUndefined();
  });
});
