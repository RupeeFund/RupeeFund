export const CONTENT_COLLECTIONS = ["posts", "pages", "faq", "people"];

export const SHARED_PAGE = { maxAge: 60 * 60, swr: 24 * 60 * 60, tags: CONTENT_COLLECTIONS };

const SHAREABLE_TYPE = /^(?:text\/html|application\/(?:rss\+)?xml)\b/;
const UNSHARED = /\b(?:private|no-store)\b/i;
const PRIVATE_TREES = /^\/(?:_emdash|auth)(?:\/|$)/;

export interface PageRequest {
  method: string;
  path: string;
  search: string;
  signedIn: boolean;
}

export function sharesRequest({ method, path, search, signedIn }: PageRequest): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return search === "" && !signedIn && !PRIVATE_TREES.test(path);
}

export function sharesAnswer(response: Response): boolean {
  if (response.status !== 200) return false;
  if (UNSHARED.test(response.headers.get("cache-control") ?? "")) return false;
  return SHAREABLE_TYPE.test(response.headers.get("content-type") ?? "");
}
