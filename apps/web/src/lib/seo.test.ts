import { describe, expect, it } from "vitest";
import { isListed, normalizePath, seoForPath } from "./seo.ts";

describe("normalizePath", () => {
  it("strips the .html build-format extension", () => {
    expect(normalizePath("/subscribe.html")).toBe("/subscribe");
  });

  it("keeps the root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("strips a trailing slash", () => {
    expect(normalizePath("/waitlist-confirmed/")).toBe("/waitlist-confirmed");
  });
});

describe("seoForPath", () => {
  it("matches the home route", () => {
    expect(seoForPath("/").canonical).toBe("https://rupeefund.org");
  });

  it("matches a route from a build-format .html pathname", () => {
    expect(seoForPath("/subscribe.html")).toEqual(seoForPath("/subscribe"));
  });

  it("matches a route from a trailing-slash pathname", () => {
    expect(seoForPath("/waitlist-confirmed/")).toEqual(seoForPath("/waitlist-confirmed"));
  });

  it("matches the people route", () => {
    expect(seoForPath("/people")).toMatchObject({
      canonical: "https://rupeefund.org/people",
      indexable: true,
    });
  });

  it("marks a waitlist outcome page as non-indexable", () => {
    expect(seoForPath("/waitlist-confirmed.html").indexable).toBe(false);
  });

  it("refuses an unknown path, because the home canonical would deduplicate the page away", () => {
    expect(() => seoForPath("/does-not-exist")).toThrow(/No SEO entry/);
  });

  it("derives each canonical from the path, so the two cannot disagree", () => {
    expect(seoForPath("/").canonical).toBe("https://rupeefund.org");
    expect(seoForPath("/privacy").canonical).toBe("https://rupeefund.org/privacy");
  });
});

describe("seoForPath with a route", () => {
  it("uses the given route for a page that the table does not list", () => {
    const route = {
      path: "/blog/hello",
      title: "Hello — The Rupee Fund",
      description: "First post.",
      indexable: true,
    };
    expect(seoForPath("/blog/hello.html", route)).toMatchObject({
      title: "Hello — The Rupee Fund",
      canonical: "https://rupeefund.org/blog/hello",
    });
  });
});

describe("isListed", () => {
  it("keeps a page under a hidden path out of the listings", () => {
    expect(isListed("/404")).toBe(false);
    expect(isListed("/404/child")).toBe(false);
    expect(isListed("/4040")).toBe(true);
  });

  it("lists a public page and a trailing-slash form of it", () => {
    expect(isListed("/people")).toBe(true);
    expect(isListed("/people/")).toBe(true);
  });
});
