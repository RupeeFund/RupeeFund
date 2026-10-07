import { describe, expect, it, vi } from "vitest";
import {
  policyDeleteGate,
  policyEditGate,
  policyGate,
  rebuildSite,
  scheduleGate,
} from "./site-hooks.ts";

const editor = { id: "u1", role: 40, source: "api" as const };
const admin = { id: "u2", role: 50, source: "api" as const };
const api = { source: "api" as const };

describe("the policy gate", () => {
  it("lets an editor publish outside the policies", () => {
    expect(policyGate({ collection: "posts", origin: api, actor: editor })).toBeUndefined();
  });

  it("refuses a policy action by an editor, with a reason", () => {
    expect(policyGate({ collection: "policies", origin: api, actor: editor })).toEqual({
      cancel: true,
      reason: "Only an admin can publish, schedule or unpublish a policy.",
    });
  });

  it("refuses a policy action with no actor from a human origin", () => {
    expect(policyGate({ collection: "policies", origin: api })).toMatchObject({ cancel: true });
  });

  it("lets an admin act on a policy", () => {
    expect(policyGate({ collection: "policies", origin: api, actor: admin })).toBeUndefined();
  });

  it("lets the scheduler publish a policy that an admin scheduled", () => {
    expect(policyGate({ collection: "policies", origin: { source: "scheduler" } })).toBeUndefined();
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

describe("the policy edit gate", () => {
  it("refuses an edit of a policy by an editor, so a scheduled policy keeps the admin's text", () => {
    expect(() => policyEditGate({ collection: "policies", actor: editor })).toThrow(
      expect.objectContaining({
        name: "ContentSaveRejectedError",
        message: "Only an admin can edit a policy.",
      }),
    );
  });

  it("refuses an edit of a policy with no actor", () => {
    expect(() => policyEditGate({ collection: "policies" })).toThrow(
      "Only an admin can edit a policy.",
    );
  });

  it("lets an admin edit a policy, and an editor edit a post", () => {
    expect(() => policyEditGate({ collection: "policies", actor: admin })).not.toThrow();
    expect(() => policyEditGate({ collection: "posts", actor: editor })).not.toThrow();
  });
});

describe("the policy delete gate", () => {
  it("refuses the delete of a policy, because the site needs all four", () => {
    expect(policyDeleteGate({ collection: "policies" })).toBe(false);
  });

  it("lets other entries go", () => {
    expect(policyDeleteGate({ collection: "faq" })).toBeUndefined();
  });
});

describe("the site rebuild", () => {
  it("posts to the deploy hook", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(rebuildSite("https://hook.example/x", fetcher)).resolves.toBe("sent");
    expect(fetcher).toHaveBeenCalledWith("https://hook.example/x", { method: "POST" });
  });

  it("skips the rebuild when no deploy hook is set", async () => {
    const fetcher = vi.fn();
    await expect(rebuildSite(undefined, fetcher)).resolves.toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails when the deploy hook refuses the request", async () => {
    const fetcher = async () => new Response("no", { status: 404 });
    await expect(rebuildSite("https://hook.example/x", fetcher)).rejects.toThrow(/answered 404/);
  });
});
