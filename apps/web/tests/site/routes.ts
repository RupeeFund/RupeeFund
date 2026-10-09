import { randomBytes, randomUUID } from "node:crypto";
import {
  DRAFT_MEDIA,
  DRAFT_SLUGS,
  PAGES,
  POST_SLUGS,
  PUBLISHED_MEDIA,
} from "../fixtures/content.ts";

export const RENDERED = "dist-preview/rendered";

export const ROUTES: readonly string[] = [
  "/",
  "/subscribe",
  "/waitlist-confirmed",
  "/faq",
  "/people",
  "/blog",
  "/blog/rss.xml",
  "/sitemap.xml",
  "/robots.txt",
  "/404",
  "/500",
  ...PAGES.map(({ slug }) => `/${slug}`),
  ...POST_SLUGS.map((slug) => `/blog/${slug}`),
];

export const MISSING: readonly string[] = [
  "/no-such-page",
  "/blog/no-such-post",
  "/a/b",
  "/Privacy",
  "/media/01M42NONE0000000000000000.jpg",
  "/media/x.svg",
  "/media/a/b.jpg",
  ...DRAFT_SLUGS.map((slug) => `/blog/${slug}`),
];

export const DENIED: readonly string[] = [
  "/_emdash/api/health",
  "/_emdash//api/health",
  "/_emdash/api/%68ealth",
  "/_emdash/api/setup/status",
  "/_emdash/api/oauth/register",
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-authorization-server/_emdash",
  "/sitemap-posts.xml",
];

export const CONTENT_MANAGER: readonly string[] = ["/_emdash/admin/login"];

export interface Answer {
  status: number;
  type: string | null;
  csp: string | null;
  frame: string | null;
  robots: string | null;
  hsts: string | null;
  body: string | null;
  cache: string | null;
}

export const MEDIA_ROUTES: readonly string[] = PUBLISHED_MEDIA.flatMap((file) => [
  `/media/${file}`,
  `/_emdash/api/media/file/${file}`,
]);

const resized = (file: string): string =>
  `/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2F${file}&w=100&f=webp`;

export const GATED_MEDIA: readonly string[] = DRAFT_MEDIA.flatMap((file) => [
  `/media/${file}`,
  `/_emdash/api/media/file/${file}`,
  resized(file),
]);

export const RESIZED_MEDIA: readonly string[] = PUBLISHED_MEDIA.map(resized);

const throwaway = (): string => `ec_pat_${randomBytes(24).toString("base64url")}`;

export const TOKENS = {
  editor: { user: "site-test-editor", role: 40, token: throwaway(), scopes: ["content:write"] },
  admin: {
    user: "site-test-admin",
    role: 50,
    token: throwaway(),
    scopes: ["content:write", "schema:write"],
  },
} as const;

export const FORGED_TOKEN = throwaway();

export const SESSION = { user: "site-test-browser", role: 50, id: randomUUID() } as const;

export interface Call {
  as: keyof typeof TOKENS | "session" | "anonymous" | "forged";
  method: string;
  path: string;
  body?: unknown;
}

export const callName = ({ as, method, path }: Call): string => `${as} ${method} ${path}`;

const SCHEMA_WRITE = "/_emdash/api/schema/collections";

export const REFUSED_WRITES: readonly Call[] = [
  { as: "editor", method: "PUT", path: "/_emdash/api/content/pages/terms" },
  { as: "editor", method: "POST", path: "/_emdash/api/content/pages/terms/duplicate" },
];

export const ALLOWED_WRITES: readonly Call[] = [
  { as: "admin", method: "PUT", path: "/_emdash/api/content/pages/terms" },
  { as: "editor", method: "PUT", path: `/_emdash/api/content/posts/${POST_SLUGS[0]}` },
];

export const SESSION_SCHEMA_WRITE: Call = { as: "session", method: "POST", path: SCHEMA_WRITE };

export const TOKEN_SCHEMA_WRITE: Call = { as: "admin", method: "POST", path: SCHEMA_WRITE };

const MCP = "/_emdash/api/mcp";

const LIST_TOOLS = { jsonrpc: "2.0", id: 1, method: "tools/list" };

export const TOKEN_MCP: Call = { as: "admin", method: "POST", path: MCP, body: LIST_TOOLS };

export const SESSION_MCP: Call = { as: "session", method: "POST", path: MCP, body: LIST_TOOLS };

export const FORGED_MCP: Call = { as: "forged", method: "POST", path: MCP, body: LIST_TOOLS };

export const ANONYMOUS_CALLS: readonly Call[] = [
  { as: "anonymous", method: "POST", path: SCHEMA_WRITE },
  { as: "anonymous", method: "GET", path: "/_emdash/api/auth/oauth/github" },
  { as: "anonymous", method: "POST", path: "/_emdash/api/auth/passkey/options" },
  { as: "anonymous", method: "POST", path: "/_emdash/api/auth/magic-link/send" },
  { as: "anonymous", method: "POST", path: "/_emdash/api/auth/signup/request" },
  { as: "anonymous", method: "GET", path: "/_emdash/api/search?q=fund" },
  { as: "anonymous", method: "GET", path: "/_emdash/api/search/suggest?q=fu" },
  { as: "anonymous", method: "GET", path: "/_emdash/api/dashboard" },
  { as: "anonymous", method: "GET", path: "/_emdash/admin" },
  { as: "anonymous", method: "POST", path: MCP },
];

export const TOKEN_ON_PUBLIC_ROUTE: Call = {
  as: "admin",
  method: "GET",
  path: "/_emdash/api/auth/oauth/github",
};

export const SIGNED_IN_SEARCH: Call = {
  as: "session",
  method: "GET",
  path: "/_emdash/api/search?q=fund",
};

export const SIGNED_IN_READS: readonly Call[] = [...GATED_MEDIA, ...RESIZED_MEDIA.slice(0, 1)].map(
  (path) => ({ as: "session", method: "GET", path }),
);

export const fileFor = (route: string): string =>
  route === "/" ? "index.html" : /\.\w+$/.test(route) ? route.slice(1) : `${route.slice(1)}.html`;

export interface Visit {
  path: string;
  editMode: boolean;
}

export interface Seen {
  status: number;
  location: string | null;
  setCookie: string | null;
  pill: boolean;
  toolbar: boolean;
  marks: number;
}

export const LEGAL_PAGE = PAGES.find(({ kind }) => kind === "legal")!;

export const VISITS = {
  "an Admin on the home page": { path: "/", editMode: false },
  "an Admin on a legal page": { path: `/${LEGAL_PAGE.slug}`, editMode: false },
  "an Admin's edit link": { path: "/?_edit=1", editMode: false },
  "an Admin with an old edit cookie": { path: "/", editMode: true },
} as const satisfies Record<string, Visit>;
