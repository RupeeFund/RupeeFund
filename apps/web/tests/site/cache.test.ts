import { describe, expect, it } from "vitest";
import seed from "../../seed/seed.json" with { type: "json" };
import { answers, visits } from "./dist.ts";
import { HOME_ALIASES, MEDIA_ROUTES, ROUTES } from "./routes.ts";

const SHARED = "public, max-age=3600, stale-while-revalidate=86400";
const COLLECTIONS = seed.collections.map(({ slug }) => slug);
const STATIC = ["/robots.txt"];
const PAGES = ROUTES.filter((route) => !["/404", "/500", ...STATIC].includes(route));
const HOURLY = "public, max-age=1800, stale-while-revalidate=1800";

describe("the edge cache", () => {
  it.each(["/", ...HOME_ALIASES])("serves no home page at %s more than an hour old", (route) => {
    const { edge, tags } = answers()[route]!;
    expect(edge).toBe(HOURLY);
    expect(tags?.split(",")).toEqual(expect.arrayContaining(COLLECTIONS));
  });

  it.each(PAGES.filter((route) => route !== "/"))(
    "keeps %s for an hour, tagged with each collection",
    (route) => {
      const { edge, tags } = answers()[route]!;
      expect(edge).toBe(SHARED);
      expect(tags?.split(",")).toEqual(expect.arrayContaining(COLLECTIONS));
    },
  );

  it.each(MEDIA_ROUTES)("never keeps the file %s", (route) => {
    expect(answers()[route]?.edge).toBe("no-store");
  });

  it.each(MEDIA_ROUTES.filter((route) => route.startsWith("/media/")))(
    "lets a browser keep %s for 5 minutes",
    (route) => {
      expect(answers()[route]?.cache).toBe("public, max-age=300");
    },
  );

  it("keeps no other answer", () => {
    const kept = Object.entries(answers())
      .filter(([route]) => ![...PAGES, ...HOME_ALIASES, ...STATIC].includes(route))
      .filter(([, { edge }]) => edge !== "no-store")
      .map(([route, { edge }]) => `${route}: ${edge}`);
    expect(kept).toEqual([]);
  });

  it("keeps no page that a signed-in person sees", () => {
    const kept = Object.entries(visits())
      .filter(([, { edge }]) => edge !== "no-store")
      .map(([visit, { edge }]) => `${visit}: ${edge}`);
    expect(kept).toEqual([]);
  });
});
