import { env } from "cloudflare:workers";
import { MEDIA_FILE } from "@rupeefund/content/schema";
import { getEmDashCollection } from "emdash";
import { mediaFile } from "./media-file.ts";
import type { PublicDeps } from "./public-routes.ts";
import type { Collections, Entry } from "./published.ts";

const COLLECTIONS = ["posts", "faq", "home", "people_page", "people", "policies"] as const;

async function published(collection: (typeof COLLECTIONS)[number]): Promise<Entry[]> {
  const entries: Entry[] = [];
  let cursor: string | undefined;
  do {
    const page = await getEmDashCollection(collection, { status: "published", limit: 100, cursor });
    if (page.error) throw page.error;
    entries.push(
      ...page.entries.map((entry) => ({
        slug: entry.id,
        data: { ...entry.data } as Entry["data"],
      })),
    );
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

export async function load(): Promise<Collections> {
  const loaded = await Promise.all(COLLECTIONS.map(published));
  return Object.fromEntries(COLLECTIONS.map((name, i) => [name, loaded[i]])) as Collections;
}

export async function readMedia(
  key: string,
  cacheControl = "public, max-age=300",
): Promise<Response | null> {
  if (!MEDIA_FILE.test(key)) return null;
  const object = await env.MEDIA.get(key);
  return object ? mediaFile(key, object.body, cacheControl) : null;
}

export const publicDeps = (): PublicDeps => ({ limiter: env.PUBLIC_LIMITER, load, readMedia });
