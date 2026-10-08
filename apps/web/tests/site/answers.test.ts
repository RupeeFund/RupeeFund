import { describe, expect, it } from "vitest";
import { answers } from "./dist.ts";
import { MEDIA_ROUTES, MISSING, ROUTES } from "./routes.ts";

describe("the live pages", () => {
  it("answer 200 for each page, and 404 for the not-found page", () => {
    const statuses = Object.fromEntries(ROUTES.map((route) => [route, answers()[route]?.status]));
    expect(statuses).toEqual(
      Object.fromEntries(ROUTES.map((route) => [route, route === "/404" ? 404 : 200])),
    );
  });

  it.each(MISSING)("answer 404 for %s, which nothing publishes", (route) => {
    expect(answers()[route]?.status).toBe(404);
  });

  it.each(MEDIA_ROUTES)("serve the image %s from the media library", (route) => {
    expect(answers()[route]).toEqual({
      status: 200,
      type: "image/jpeg",
      csp: "default-src 'none'; sandbox",
    });
  });
});
