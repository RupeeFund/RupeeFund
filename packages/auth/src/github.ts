export interface GitHubApp {
  clientId: string;
  clientSecret: string;
  org: string;
}

export interface Member {
  email: string;
  name: string;
  role: number;
}

export type SignInResult =
  | { ok: true; member: Member }
  | { ok: false; reason: "no-email" | "no-team" };

export const TEAM_ROLES: Readonly<Record<string, number>> = {
  "cms-admins": 50,
  "cms-editors": 40,
  "cms-authors": 30,
};

const API = "https://api.github.com";

export function authorizeUrl(
  app: GitHubApp,
  redirectUri: string,
  state: string,
  challenge: string,
): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

export function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

async function accessToken(
  code: string,
  verifier: string,
  redirectUri: string,
  app: GitHubApp,
  fetcher: typeof fetch,
): Promise<string> {
  const response = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  const grant = (await response.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!response.ok || typeof grant?.access_token !== "string") {
    throw new Error("GitHub gave no access token");
  }
  return grant.access_token;
}

export async function signIn(
  code: string,
  verifier: string,
  redirectUri: string,
  app: GitHubApp,
  fetcher: typeof fetch = fetch,
): Promise<SignInResult> {
  const bearer = await accessToken(code, verifier, redirectUri, app, fetcher);
  const call = async (path: string): Promise<Response> =>
    fetcher(`${API}${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${bearer}`,
        "user-agent": "rupeefund-web",
        "x-github-api-version": "2022-11-28",
      },
    });
  const read = async <T>(path: string): Promise<T> => {
    const response = await call(path);
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`);
    return (await response.json()) as T;
  };

  const user = await read<{ login: string; name: string | null }>("/user");
  const emails =
    await read<{ email: string; primary: boolean; verified: boolean }[]>("/user/emails");
  const email = emails.find((entry) => entry.primary && entry.verified)?.email.toLowerCase();
  if (email === undefined) return { ok: false, reason: "no-email" };

  const roles = await Promise.all(
    Object.entries(TEAM_ROLES).map(async ([team, role]) => {
      const path = `/orgs/${app.org}/teams/${team}/memberships/${encodeURIComponent(user.login)}`;
      const response = await call(path);
      if (response.status === 404) return 0;
      if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`);
      const membership = (await response.json()) as { state?: unknown };
      return membership.state === "active" ? role : 0;
    }),
  );
  const role = Math.max(...roles);
  if (role === 0) return { ok: false, reason: "no-team" };
  return { ok: true, member: { email, name: user.name || user.login, role } };
}
