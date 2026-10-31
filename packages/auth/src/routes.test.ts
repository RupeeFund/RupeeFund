import { afterEach, describe, expect, it, vi } from "vitest";
import { open, seal } from "./seal.ts";
import { authRoute, cookieNames, identityOf, signOutCookie, type AuthConfig } from "./routes.ts";

const CONFIG: AuthConfig = {
  app: { clientId: "Iv-test", clientSecret: "test-client-secret", org: "RupeeFund" },
  secret: "test-signing-secret-of-enough-length",
  origin: "https://rupeefund.org",
};
const ORIGIN = "https://rupeefund.org";
const { identity: IDENTITY_COOKIE, signin: SIGNIN_COOKIE } = cookieNames(ORIGIN);

afterEach(() => {
  vi.restoreAllMocks();
});

function cookiesOf(response: Response): Map<string, string> {
  const pairs = response.headers.getSetCookie().map((line) => {
    const [pair = ""] = line.split(";");
    const at = pair.indexOf("=");
    return [pair.slice(0, at), line] as const;
  });
  return new Map(pairs);
}

const valueOf = (line: string | undefined): string =>
  decodeURIComponent(line?.split(";")[0]?.split("=")[1] ?? "");

function member(role: number): typeof fetch {
  return async (input, init) => {
    const { pathname } = new URL(new Request(input, init).url);
    if (pathname === "/login/oauth/access_token")
      return Response.json({ access_token: "ghu_test" });
    if (pathname === "/user") return Response.json({ login: "octo", name: "Octo" });
    if (pathname === "/user/emails")
      return Response.json([{ email: "o@example.com", primary: true, verified: true }]);
    if (role === 50 && pathname.endsWith("/teams/cms-admins/memberships/octo"))
      return Response.json({ state: "active" });
    return new Response("Not Found", { status: 404 });
  };
}

async function startSignIn(query = ""): Promise<{ state: string; cookie: string }> {
  const response = await authRoute(new Request(`${ORIGIN}/auth/login${query}`), CONFIG);
  const location = new URL(response?.headers.get("location") ?? "");
  return {
    state: location.searchParams.get("state") ?? "",
    cookie: valueOf(cookiesOf(response as Response).get(SIGNIN_COOKIE)),
  };
}

const callback = (query: string, cookie: string, fetcher: typeof fetch) =>
  authRoute(
    new Request(`${ORIGIN}/auth/callback?${query}`, {
      headers: { cookie: `${SIGNIN_COOKIE}=${encodeURIComponent(cookie)}` },
    }),
    CONFIG,
    fetcher,
  );

describe("authRoute", () => {
  it.each(["/auth", "/auth/logout"])("leaves %s alone", async (path) => {
    expect(await authRoute(new Request(`${ORIGIN}${path}`), CONFIG)).toBeNull();
  });

  it("sends the browser to GitHub with a sealed, short-lived sign-in cookie", async () => {
    const response = await authRoute(new Request(`${ORIGIN}/auth/login`), CONFIG);
    const location = new URL(response?.headers.get("location") ?? "");
    expect(response?.status).toBe(302);
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/callback`);
    const line = cookiesOf(response as Response).get(SIGNIN_COOKIE) ?? "";
    expect(line).toMatch(/; Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Lax$/);
    expect(await open(valueOf(line), CONFIG.secret)).toMatchObject({
      state: location.searchParams.get("state"),
    });
  });

  it("signs in a team member and sets the identity cookie for 8 hours", async () => {
    const { state, cookie } = await startSignIn();
    const response = await callback(`code=c&state=${state}`, cookie, member(50));
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("/_emdash/admin");
    const cookies = cookiesOf(response as Response);
    expect(cookies.get(IDENTITY_COOKIE)).toMatch(
      /; Path=\/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax$/,
    );
    expect(cookies.get(SIGNIN_COOKIE)).toMatch(/Max-Age=0/);
    expect(await open(valueOf(cookies.get(IDENTITY_COOKIE)), CONFIG.secret)).toEqual({
      email: "o@example.com",
      name: "Octo",
      role: 50,
    });
  });

  it("returns a team member to the content manager page that sent them to sign in", async () => {
    const page = "/_emdash/admin/content/posts?locale=en";
    const { state, cookie } = await startSignIn(`?next=${encodeURIComponent(page)}`);
    const response = await callback(`code=c&state=${state}`, cookie, member(50));
    expect(response?.headers.get("location")).toBe(page);
  });

  it("drops a line break from the return address and still signs the member in", async () => {
    const { state, cookie } = await startSignIn("?next=%2F_emdash%2Fadmin%2F%0Amedia");
    const response = await callback(`code=c&state=${state}`, cookie, member(50));
    expect(response?.headers.get("location")).toBe("/_emdash/admin/media");
  });

  it.each([
    "//evil.example",
    "https://evil.example/_emdash/admin",
    "/blog",
    "/_emdash/adminx",
    "/_emdash/admin/../../blog",
    "http://[",
  ])("sends a team member to the content manager home, not to %s", async (next) => {
    const { state, cookie } = await startSignIn(`?next=${encodeURIComponent(next)}`);
    const response = await callback(`code=c&state=${state}`, cookie, member(50));
    expect(response?.headers.get("location")).toBe("/_emdash/admin");
  });

  it("refuses a GitHub user in none of the teams and sets no identity", async () => {
    const { state, cookie } = await startSignIn();
    const response = await callback(`code=c&state=${state}`, cookie, member(0));
    expect(response?.status).toBe(403);
    expect(cookiesOf(response as Response).has(IDENTITY_COOKIE)).toBe(false);
  });

  it.each([
    ["a changed state", (state: string) => `code=c&state=${state}x`],
    ["no code", (state: string) => `state=${state}`],
  ])("refuses a callback with %s", async (_name, query) => {
    const { state, cookie } = await startSignIn();
    const response = await callback(query(state), cookie, member(50));
    expect(response?.status).toBe(400);
  });

  it("tells a person who cancelled at GitHub how to sign in again", async () => {
    const { state, cookie } = await startSignIn();
    const response = await callback(`error=access_denied&state=${state}`, cookie, member(50));
    expect(await response?.text()).toBe(
      "You cancelled the sign-in at GitHub. Sign in again from /auth/login.",
    );
  });

  it("refuses a callback without the sign-in cookie", async () => {
    const { state } = await startSignIn();
    const response = await callback(`code=c&state=${state}`, "", member(50));
    expect(response?.status).toBe(400);
  });

  it("answers 502 when GitHub fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { state, cookie } = await startSignIn();
    const response = await callback(
      `code=c&state=${state}`,
      cookie,
      async () => new Response("", { status: 500 }),
    );
    expect(response?.status).toBe(502);
    expect(logged).toHaveBeenCalledWith(
      "[auth] GitHub sign-in failed:",
      "Error: GitHub gave no access token: status 500",
    );
  });

  it("logs the error of GitHub, and not the code or the secret", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { state, cookie } = await startSignIn();
    const response = await callback(`code=code-in-the-link&state=${state}`, cookie, async () =>
      Response.json({ error: "bad_verification_code" }),
    );
    expect(response?.status).toBe(502);
    expect(logged).toHaveBeenCalledWith(
      "[auth] GitHub sign-in failed:",
      "Error: GitHub gave no access token: bad_verification_code",
    );
    const line = logged.mock.calls.flat().join(" ");
    expect(line).not.toContain("code-in-the-link");
    expect(line).not.toContain(CONFIG.app.clientSecret);
  });

  it("drops Secure on plain http for the local build", async () => {
    const local = { ...CONFIG, origin: "http://localhost:8789" };
    const response = await authRoute(new Request("http://rupeefund.org/auth/login"), local);
    const location = new URL(response?.headers.get("location") ?? "");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:8789/auth/callback");
    const line = cookiesOf(response as Response).get(cookieNames(local.origin).signin);
    expect(line).not.toMatch(/Secure/);
  });
});

describe("cookieNames", () => {
  it("locks the cookies to this host on https, so a sibling subdomain cannot set them", () => {
    expect(cookieNames("https://rupeefund.org")).toEqual({
      identity: "__Host-rupeefund_auth",
      signin: "__Host-rupeefund_signin",
    });
  });

  it("drops the prefix on plain http, where a browser refuses it", () => {
    expect(cookieNames("http://localhost:8789")).toEqual({
      identity: "rupeefund_auth",
      signin: "rupeefund_signin",
    });
  });
});

describe("signOutCookie", () => {
  it("clears the identity cookie", () => {
    expect(signOutCookie(ORIGIN)).toBe(
      `${IDENTITY_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    );
  });
});

describe("identityOf", () => {
  const withCookie = (value: string) =>
    new Request(ORIGIN, { headers: { cookie: `a=b; ${IDENTITY_COOKIE}=${value}` } });

  it("reads a sealed identity", async () => {
    const token = await seal({ email: "o@example.com", name: "Octo", role: 40 }, CONFIG.secret, 60);
    expect(await identityOf(withCookie(token), CONFIG.secret, ORIGIN)).toEqual({
      email: "o@example.com",
      name: "Octo",
      role: 40,
    });
  });

  it("refuses an identity with a role outside the teams", async () => {
    const token = await seal({ email: "o@example.com", name: "Octo", role: 99 }, CONFIG.secret, 60);
    expect(await identityOf(withCookie(token), CONFIG.secret, ORIGIN)).toBeNull();
  });

  it("refuses a sealed value that is not an identity", async () => {
    const token = await seal({ state: "s", verifier: "v" }, CONFIG.secret, 60);
    expect(await identityOf(withCookie(token), CONFIG.secret, ORIGIN)).toBeNull();
  });

  it("refuses a request with no identity cookie", async () => {
    expect(await identityOf(new Request(ORIGIN), CONFIG.secret, ORIGIN)).toBeNull();
  });
});
