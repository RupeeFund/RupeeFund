import {
  TEAM_ROLES,
  authorizeUrl,
  challengeOf,
  randomToken,
  signIn,
  type GitHubApp,
  type Member,
} from "./github.ts";
import { open, seal } from "./seal.ts";

export interface AuthConfig {
  app: GitHubApp;
  secret: string;
  origin: string;
}

export const SESSION_COOKIE = "astro-session";
export const IDENTITY_SECONDS = 8 * 60 * 60;
const SIGNIN_SECONDS = 10 * 60;

const REFUSED: Readonly<Record<"no-email" | "no-team", string>> = {
  "no-email":
    "Your GitHub account has no verified primary email. Verify one on GitHub, then sign in again.",
  "no-team":
    "Your GitHub account is not in a content team of The Rupee Fund. Ask an admin to add you.",
};

export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at !== -1 && part.slice(0, at).trim() === name) {
      try {
        return decodeURIComponent(part.slice(at + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

const secureOrigin = (origin: string): boolean => new URL(origin).protocol === "https:";

export function cookieNames(origin: string): { identity: string; signin: string } {
  const prefix = secureOrigin(origin) ? "__Host-" : "";
  return { identity: `${prefix}rupeefund_auth`, signin: `${prefix}rupeefund_signin` };
}

function cookie(origin: string, name: string, value: string, seconds: number): string {
  const secure = secureOrigin(origin) ? "; Secure" : "";
  const attributes = `Path=/; Max-Age=${seconds}; HttpOnly${secure}; SameSite=Lax`;
  return `${name}=${encodeURIComponent(value)}; ${attributes}`;
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const line of cookies) headers.append("set-cookie", line);
  return new Response(null, { status: 302, headers });
}

function text(status: number, message: string, cookies: string[] = []): Response {
  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const line of cookies) headers.append("set-cookie", line);
  return new Response(message, { status, headers });
}

export async function identityOf(
  request: Request,
  secret: string,
  origin: string,
): Promise<Member | null> {
  const value = await open(readCookie(request, cookieNames(origin).identity), secret);
  if (value === null) return null;
  const { email, name, role } = value;
  if (typeof email !== "string" || email === "" || typeof name !== "string") return null;
  if (typeof role !== "number" || !Object.values(TEAM_ROLES).includes(role)) return null;
  return { email, name, role };
}

export const signOutCookie = (origin: string): string =>
  cookie(origin, cookieNames(origin).identity, "", 0);

async function login(config: AuthConfig): Promise<Response> {
  const state = randomToken();
  const verifier = randomToken();
  const sealed = await seal({ state, verifier }, config.secret, SIGNIN_SECONDS);
  const target = authorizeUrl(config.app, callbackUrl(config), state, await challengeOf(verifier));
  const name = cookieNames(config.origin).signin;
  return redirect(target, [cookie(config.origin, name, sealed, SIGNIN_SECONDS)]);
}

const callbackUrl = (config: AuthConfig): string => `${config.origin}/auth/callback`;

async function callback(
  request: Request,
  config: AuthConfig,
  fetcher: typeof fetch,
): Promise<Response> {
  const names = cookieNames(config.origin);
  const clear = [cookie(config.origin, names.signin, "", 0)];
  const query = new URL(request.url).searchParams;
  const code = query.get("code");
  const started = await open(readCookie(request, names.signin), config.secret);
  const { state, verifier } = started ?? {};
  if (
    code === null ||
    typeof state !== "string" ||
    typeof verifier !== "string" ||
    query.get("state") !== state
  ) {
    return text(400, "This sign-in link is not valid. Sign in again from /auth/login.", clear);
  }
  try {
    const result = await signIn(code, verifier, callbackUrl(config), config.app, fetcher);
    if (!result.ok) return text(403, REFUSED[result.reason], clear);
    const identity = await seal(result.member, config.secret, IDENTITY_SECONDS);
    return redirect("/_emdash/admin", [
      ...clear,
      cookie(config.origin, names.identity, identity, IDENTITY_SECONDS),
    ]);
  } catch (error) {
    console.error("[auth] GitHub sign-in failed:", error);
    return text(502, "GitHub sign-in failed. Sign in again from /auth/login.", clear);
  }
}

export async function authRoute(
  request: Request,
  config: AuthConfig,
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  switch (new URL(request.url).pathname) {
    case "/auth/login":
      return login(config);
    case "/auth/callback":
      return callback(request, config, fetcher);
    default:
      return null;
  }
}
