import { describe, expect, it } from "vitest";
import seed from "../../seed/seed.json" with { type: "json" };
import { CONTENT_COLLECTIONS, sharesAnswer, sharesRequest, type PageRequest } from "./cache.ts";

const page = (headers: Record<string, string> = {}, status = 200): Response =>
  new Response("", { status, headers: { "content-type": "text/html", ...headers } });

const anonymous: PageRequest = { method: "GET", path: "/faq", search: "", signedIn: false };

describe("sharesRequest", () => {
  it("shares an anonymous read of a page", () => {
    expect(sharesRequest(anonymous)).toBe(true);
  });

  it.each<[string, Partial<PageRequest>]>([
    ["a write", { method: "POST" }],
    ["a signed-in read", { signedIn: true }],
    ["a URL with a query", { search: "?_preview=token" }],
    ["the content manager", { path: "/_emdash/admin" }],
    ["the sign-in routes", { path: "/auth/login" }],
  ])("keeps %s out of the shared cache", (_, change) => {
    expect(sharesRequest({ ...anonymous, ...change })).toBe(false);
  });
});

describe("sharesAnswer", () => {
  it("shares a page, the feed and the sitemap", () => {
    expect(sharesAnswer(page())).toBe(true);
    expect(sharesAnswer(page({ "content-type": "application/xml" }))).toBe(true);
  });

  it.each<[string, Response]>([
    ["a missing page", page({}, 404)],
    ["a private answer", page({ "cache-control": "private, no-store" })],
    ["a file", page({ "content-type": "image/jpeg" })],
  ])("keeps %s out of the shared cache", (_, response) => {
    expect(sharesAnswer(response)).toBe(false);
  });
});

it("tags each page with every collection that a publish purges", () => {
  expect(CONTENT_COLLECTIONS).toEqual(seed.collections.map(({ slug }) => slug));
});
