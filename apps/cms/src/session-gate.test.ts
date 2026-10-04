import { describe, expect, it } from "vitest";
import { needsSession, refusesStranger } from "./session-gate.ts";

const FILE = "/_emdash/api/media/file/backups/site.json";

describe("the paths that need a signed-in person", () => {
  it("include each stored file EmDash serves", () => {
    expect(needsSession(FILE)).toBe(true);
    expect(needsSession("/_image")).toBe(true);
    expect(needsSession("/_image/")).toBe(true);
  });

  it("leave out the published content and its media", () => {
    expect(needsSession("/published.json")).toBe(false);
    expect(needsSession("/media/hero.png")).toBe(false);
    expect(needsSession("/_emdash/api/media")).toBe(false);
  });
});

describe("the stored file gate", () => {
  it("refuses a request with no session", async () => {
    expect(await refusesStranger(FILE)).toBe(true);
  });

  it("refuses a session with no user", async () => {
    expect(await refusesStranger(FILE, async () => undefined)).toBe(true);
  });

  it("lets a signed-in person through", async () => {
    expect(await refusesStranger(FILE, async () => ({ id: "u1" }))).toBe(false);
  });

  it("refuses when the session store does not answer in time", async () => {
    const stalled = () => new Promise<never>(() => {});
    expect(await refusesStranger(FILE, stalled, 10)).toBe(true);
  });

  it("refuses when the session store fails", async () => {
    expect(await refusesStranger(FILE, () => Promise.reject(new Error("kv down")))).toBe(true);
  });

  it("reads no session for a public path", async () => {
    const readUser = async () => {
      throw new Error("read the session");
    };
    expect(await refusesStranger("/published.json", readUser)).toBe(false);
  });
});
