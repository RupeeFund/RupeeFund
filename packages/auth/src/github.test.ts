import { describe, expect, it } from "vitest";
import { authorizeUrl, challengeOf, signIn, type GitHubApp } from "./github.ts";

const APP: GitHubApp = {
  clientId: "Iv-test",
  clientSecret: "test-client-secret",
  org: "RupeeFund",
};
const REDIRECT = "http://localhost:8789/auth/callback";

interface World {
  teams?: Record<string, string>;
  emails?: { email: string; primary: boolean; verified: boolean }[];
  grant?: unknown;
  name?: string | null;
}

function github(world: World): { fetcher: typeof fetch; calls: Request[] } {
  const calls: Request[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    calls.push(request);
    const { pathname, hostname } = new URL(request.url);
    if (hostname === "github.com" && pathname === "/login/oauth/access_token") {
      return Response.json(world.grant ?? { access_token: "ghu_test" });
    }
    if (pathname === "/user")
      return Response.json({ login: "octo", name: "name" in world ? world.name : "Octo Cat" });
    if (pathname === "/user/emails") {
      return Response.json(
        world.emails ?? [{ email: "octo@example.com", primary: true, verified: true }],
      );
    }
    const team = /^\/orgs\/RupeeFund\/teams\/([^/]+)\/memberships\/octo$/.exec(pathname)?.[1];
    const state = team === undefined ? undefined : world.teams?.[team];
    if (state === undefined) return new Response("Not Found", { status: 404 });
    return Response.json({ state, role: "member" });
  };
  return { fetcher, calls };
}

const run = (world: World) => signIn("code-1", "verifier-1", REDIRECT, APP, github(world).fetcher);

describe("authorizeUrl", () => {
  it("asks GitHub for the code with the state and an S256 challenge", () => {
    const url = new URL(authorizeUrl(APP, REDIRECT, "state-1", "challenge-1"));
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/login/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "Iv-test",
      redirect_uri: REDIRECT,
      state: "state-1",
      code_challenge: "challenge-1",
      code_challenge_method: "S256",
    });
  });
});

describe("challengeOf", () => {
  it("gives the RFC 7636 appendix B challenge", async () => {
    expect(await challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("signIn", () => {
  it("gives a member of one team the role of that team", async () => {
    expect(await run({ teams: { "cms-editors": "active" } })).toEqual({
      ok: true,
      member: { email: "octo@example.com", name: "Octo Cat", role: 40 },
    });
  });

  it("gives a member of several teams the highest role", async () => {
    const result = await run({ teams: { "cms-authors": "active", "cms-admins": "active" } });
    expect(result).toMatchObject({ ok: true, member: { role: 50 } });
  });

  it("refuses a GitHub user in none of the teams", async () => {
    expect(await run({})).toEqual({ ok: false, reason: "no-team" });
  });

  it("refuses a pending team invitation", async () => {
    expect(await run({ teams: { "cms-admins": "pending" } })).toEqual({
      ok: false,
      reason: "no-team",
    });
  });

  it("refuses a user with no verified primary email", async () => {
    const emails = [
      { email: "a@example.com", primary: true, verified: false },
      { email: "b@example.com", primary: false, verified: true },
    ];
    expect(await run({ teams: { "cms-admins": "active" }, emails })).toEqual({
      ok: false,
      reason: "no-email",
    });
  });

  it("gives the email in lower case, as EmDash looks it up", async () => {
    const emails = [{ email: "Octo@Example.com", primary: true, verified: true }];
    const result = await run({ teams: { "cms-authors": "active" }, emails });
    expect(result).toMatchObject({ ok: true, member: { email: "octo@example.com" } });
  });

  it("uses the login when the user has no display name", async () => {
    const result = await run({ teams: { "cms-authors": "active" }, name: null });
    expect(result).toMatchObject({ ok: true, member: { name: "octo" } });
  });

  it("fails when GitHub gives no access token", async () => {
    await expect(run({ grant: { error: "bad_verification_code" } })).rejects.toThrow(
      "access token",
    );
  });

  it("sends the secret and the verifier to GitHub, and the token to the API", async () => {
    const { fetcher, calls } = github({ teams: { "cms-admins": "active" } });
    await signIn("code-1", "verifier-1", REDIRECT, APP, fetcher);
    const exchange = calls[0];
    expect(exchange?.method).toBe("POST");
    expect(exchange?.headers.get("accept")).toBe("application/json");
    expect(Object.fromEntries(new URLSearchParams(await exchange?.text()))).toEqual({
      client_id: "Iv-test",
      client_secret: "test-client-secret",
      code: "code-1",
      redirect_uri: REDIRECT,
      code_verifier: "verifier-1",
    });
    expect(
      calls.slice(1).every((call) => call.headers.get("authorization") === "Bearer ghu_test"),
    ).toBe(true);
  });
});
