import { describe, expect, it } from "vitest";
import { deleteGate, publishGate, saveGate, scheduleGate, type Store } from "./hooks.ts";

const author = { id: "u0", role: 30, source: "api" as const };
const editor = { id: "u1", role: 40, source: "api" as const };
const admin = { id: "u2", role: 50, source: "api" as const };
const api = { source: "api" as const };

function store(
  entries: Record<string, Record<string, unknown>> = {},
  {
    failing = false,
    landings = 0,
    drafts = {},
  }: {
    failing?: boolean;
    landings?: number;
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
    async count(collection) {
      expect(collection).toBe("landing");
      if (failing) throw new Error("the database is unavailable");
      return landings;
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

  it("refuses an edit of the landing page by an editor", async () => {
    await expect(
      saveGate(
        { collection: "landing", content: {}, isNew: false, id: "l", actor: editor },
        store(),
      ),
    ).rejects.toThrow(
      rejected("Only an admin can edit the landing page. Ask an admin for the change."),
    );
  });

  it("refuses a second landing page, even for an admin", async () => {
    await expect(
      saveGate(
        { collection: "landing", content: {}, isNew: true, actor: admin },
        store({}, { landings: 1 }),
      ),
    ).rejects.toThrow(rejected("The landing page has one entry. Edit that entry."));
  });

  it("lets an admin create the first landing page", async () => {
    await expect(
      saveGate({ collection: "landing", content: {}, isNew: true, actor: admin }, store()),
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

  it("refuses an edit of an old policy by an editor", async () => {
    await expect(
      saveGate(
        { collection: "policies", content: {}, isNew: false, id: "x", actor: editor },
        store(),
      ),
    ).rejects.toThrow(
      rejected("Only an admin can edit a legal page. Ask an admin for the change."),
    );
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

  it("refuses an editor who publishes the landing page", async () => {
    expect(
      await publishGate(
        { collection: "landing", content: { id: "l", data: {} }, origin: api, actor: editor },
        store({}, { landings: 1 }),
      ),
    ).toMatchObject({ cancel: true });
  });

  it("refuses to publish a copy of the landing page, even for an admin", async () => {
    expect(
      await publishGate(
        { collection: "landing", content: { id: "l2", data: {} }, origin: api, actor: admin },
        store({}, { landings: 2 }),
      ),
    ).toEqual({
      cancel: true,
      reason: "The landing page has one entry. Delete the copy first.",
    });
  });

  it("refuses an old policy action by an editor", async () => {
    expect(
      await publishGate(
        { collection: "policies", content: { id: "x", data: {} }, origin: api, actor: editor },
        store(),
      ),
    ).toMatchObject({ cancel: true });
  });

  it("refuses a legal action with no actor", async () => {
    expect(
      await publishGate({ collection: "pages", content: legal, origin: api }, store()),
    ).toMatchObject({ cancel: true });
  });

  it("lets an admin publish a legal page and the one landing page", async () => {
    expect(
      await publishGate(
        { collection: "pages", content: legal, origin: api, actor: admin },
        store({ p: { kind: "legal" } }),
      ),
    ).toBeUndefined();
    expect(
      await publishGate(
        { collection: "landing", content: { id: "l", data: {} }, origin: api, actor: admin },
        store({}, { landings: 1 }),
      ),
    ).toBeUndefined();
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

  it("keeps the one landing page and the old policies", async () => {
    expect(await deleteGate({ collection: "landing", id: "l" }, store({}, { landings: 1 }))).toBe(
      false,
    );
    expect(await deleteGate({ collection: "policies", id: "x" }, store())).toBe(false);
  });

  it("keeps a landing page when the count cannot be read", async () => {
    expect(await deleteGate({ collection: "landing", id: "l" }, store({}, { failing: true }))).toBe(
      false,
    );
  });

  it("lets a copy of the landing page go", async () => {
    expect(await deleteGate({ collection: "landing", id: "l2" }, store({}, { landings: 2 }))).toBe(
      undefined,
    );
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
