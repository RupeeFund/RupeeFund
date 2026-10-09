import { describe, expect, it } from "vitest";
import { answers } from "./dist.ts";
import {
  ALLOWED_WRITES,
  ANONYMOUS_CALLS,
  CONTENT_MANAGER,
  FORGED_MCP,
  DENIED,
  GATED_MEDIA,
  MEDIA_ROUTES,
  MISSING,
  REFUSED_WRITES,
  RESIZED_MEDIA,
  ROUTES,
  SESSION_SCHEMA_WRITE,
  SIGNED_IN_READS,
  SESSION_MCP,
  SIGNED_IN_SEARCH,
  TOKEN_MCP,
  TOKEN_ON_PUBLIC_ROUTE,
  TOKEN_SCHEMA_WRITE,
  callName,
} from "./routes.ts";

const HSTS = "max-age=63072000; includeSubDomains; preload";

describe("the live pages", () => {
  it("answer 200 for each page, 404 for the not-found page and 500 for the error page", () => {
    const statuses = Object.fromEntries(ROUTES.map((route) => [route, answers()[route]?.status]));
    expect(statuses).toEqual(
      Object.fromEntries(
        ROUTES.map((route) => [route, route === "/404" ? 404 : route === "/500" ? 500 : 200]),
      ),
    );
  });

  it.each(MISSING)("answer 404 for %s, which nothing publishes", (route) => {
    expect(answers()[route]?.status).toBe(404);
  });

  it.each(MEDIA_ROUTES)("serve %s, which published content uses", (route) => {
    expect(answers()[route]).toMatchObject({
      status: 200,
      type: "image/jpeg",
      csp: expect.stringContaining("sandbox"),
    });
  });

  it.each(GATED_MEDIA)("refuse %s to a stranger, because only a draft uses it", (route) => {
    expect(answers()[route]).toMatchObject({ status: 404, body: "Not found" });
  });

  it.each(RESIZED_MEDIA)("refuse to resize %s for a stranger", (route) => {
    expect(answers()[route]).toMatchObject({ status: 404, body: "Not found" });
  });

  it.each(ROUTES)("ask the browser to use HTTPS and refuse framing on %s", (route) => {
    expect(answers()[route]).toMatchObject({ hsts: HSTS, frame: "DENY", robots: null });
  });
});

describe("the content manager routes", () => {
  it.each(DENIED)("answer 404 for %s, which no one here uses", (route) => {
    expect(answers()[route]?.status).toBe(404);
  });

  it.each(CONTENT_MANAGER)("keep %s out of search engines", (route) => {
    expect(answers()[route]).toMatchObject({
      robots: "noindex, nofollow",
      hsts: HSTS,
    });
  });
});

describe("the content guard", () => {
  it.each(REFUSED_WRITES.map(callName))("refuses %s", (name) => {
    expect(answers()[name]).toMatchObject({
      status: 403,
      body: expect.stringContaining("Only an admin can change this. Ask an admin for the change."),
    });
  });

  it.each(ALLOWED_WRITES.map(callName))("passes %s on to the content manager", (name) => {
    expect(answers()[name]?.status).toBe(200);
  });

  it("refuses a schema change from an Admin's browser session", () => {
    expect(answers()[callName(SESSION_SCHEMA_WRITE)]).toMatchObject({
      status: 403,
      body: expect.stringContaining("Change the schema with an API token"),
    });
  });

  it.each([...ANONYMOUS_CALLS, TOKEN_ON_PUBLIC_ROUTE].map(callName))(
    "refuses %s before the content manager starts",
    (name) => {
      expect(answers()[name]).toMatchObject({
        status: 401,
        cache: "no-store",
        body: expect.stringContaining("NOT_SIGNED_IN"),
      });
    },
  );

  it("gives a signed-in person the content manager search", () => {
    expect(answers()[callName(SIGNED_IN_SEARCH)]?.status).toBe(200);
  });

  it("lists the MCP tools for an API token", () => {
    expect(answers()[callName(TOKEN_MCP)]).toMatchObject({
      status: 200,
      body: expect.stringContaining('"tools"'),
    });
  });

  it("refuses the MCP server to a signed-in browser with no API token", () => {
    expect(answers()[callName(SESSION_MCP)]).toMatchObject({
      status: 401,
      body: expect.stringContaining("NOT_AUTHENTICATED"),
    });
  });

  it("refuses the MCP server to a token that EmDash does not know", () => {
    expect(answers()[callName(FORGED_MCP)]).toMatchObject({
      status: 401,
      body: expect.stringContaining("INVALID_TOKEN"),
    });
  });

  it("passes a schema change from an API token on to the content manager", () => {
    expect(answers()[callName(TOKEN_SCHEMA_WRITE)]).toMatchObject({
      status: 400,
      body: expect.stringContaining("VALIDATION_ERROR"),
    });
  });
});

describe("the media for a signed-in user", () => {
  it.each(SIGNED_IN_READS.map(callName))("serves %s privately", (name) => {
    expect(answers()[name]).toMatchObject({
      status: 200,
      type: expect.stringMatching(/^image\//),
      cache: "private, no-store",
    });
  });
});
