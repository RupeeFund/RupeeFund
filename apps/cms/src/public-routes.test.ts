import { describe, expect, it, onTestFinished, vi } from "vitest";
import fixture from "../tests/fixtures/published-entries.json";
import type { Collections } from "./published.ts";
import { mediaResponse, publishedResponse, type PublicDeps } from "./public-routes.ts";

const request = (path: string) =>
  new Request(`https://cms.rupeefund.org${path}`, {
    headers: { "cf-connecting-ip": "203.0.113.9" },
  });

function deps(overrides: Partial<PublicDeps> = {}): PublicDeps {
  return {
    limiter: { limit: async () => ({ success: true }) },
    load: async () => structuredClone(fixture) as unknown as Collections,
    readMedia: async (key) =>
      key === "01M3YV801FWWQQ8HPREHKT37ZD.png"
        ? new Response("png", { headers: { "content-type": "image/png" } })
        : null,
    ...overrides,
  };
}

describe("the published document route", () => {
  it("answers the document as JSON that no cache keeps", async () => {
    const res = await publishedResponse(request("/published.json"), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(((await res.json()) as { version: number }).version).toBe(1);
  });

  it("answers 503 when a query fails, so a build never takes an empty site", async () => {
    const res = await publishedResponse(
      request("/published.json"),
      deps({ load: async () => Promise.reject(new Error("D1 down")) }),
    );
    expect(res.status).toBe(503);
  });

  it("answers 500 when the content breaks the site's rules, and logs the reason only", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    onTestFinished(() => log.mockRestore());
    const res = await publishedResponse(
      request("/published.json"),
      deps({
        load: async () => ({ ...(structuredClone(fixture) as unknown as Collections), home: [] }),
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("home page");
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"event":"published_invalid"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("home page"));
  });

  it("answers 429 past the rate limit", async () => {
    const res = await publishedResponse(
      request("/published.json"),
      deps({ limiter: { limit: async () => ({ success: false }) } }),
    );
    expect(res.status).toBe(429);
  });
});

describe("the media route", () => {
  it("serves a file that a published entry uses", async () => {
    const res = await mediaResponse("01M3YV801FWWQQ8HPREHKT37ZD.png", request("/media/x"), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("refuses a file that no published entry uses, such as a draft image or a backup", async () => {
    const stored = deps({ readMedia: async () => new Response("png") });
    for (const key of ["01OTHER.png", "backups/site.json", "../backups/site.json"]) {
      const res = await mediaResponse(key, request("/media/x"), stored);
      expect(res.status).toBe(404);
    }
  });

  it("refuses a name that no media file can have, before it reads the content", async () => {
    let loads = 0;
    const counted = deps({
      load: async () => {
        loads++;
        return structuredClone(fixture) as unknown as Collections;
      },
    });
    const res = await mediaResponse("not-a-file", request("/media/x"), counted);
    expect(res.status).toBe(404);
    expect(loads).toBe(0);
  });

  it("answers 429 past the rate limit", async () => {
    const res = await mediaResponse(
      "01M3YV801FWWQQ8HPREHKT37ZD.png",
      request("/media/x"),
      deps({ limiter: { limit: async () => ({ success: false }) } }),
    );
    expect(res.status).toBe(429);
  });
});
