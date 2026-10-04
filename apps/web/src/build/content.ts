import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { contentDocument, type Content } from "@rupeefund/content/schema";
import { fetchPatiently, type Wait } from "./fetch.ts";

export const CMS_CONTENT_URL = "https://cms.rupeefund.org/published.json";

export type ContentSource = { kind: "url"; url: string } | { kind: "file"; path: string };

type Env = Partial<Record<"CMS_CONTENT_URL" | "CMS_CONTENT_FILE", string>>;

export function contentSource(env: Env): ContentSource {
  if (env.CMS_CONTENT_URL) return { kind: "url", url: env.CMS_CONTENT_URL };
  if (env.CMS_CONTENT_FILE) return { kind: "file", path: env.CMS_CONTENT_FILE };
  return { kind: "url", url: CMS_CONTENT_URL };
}

export interface LoadedContent {
  content: Content;
  mediaUrl: (key: string) => URL;
}

async function fetchText(url: string, fetcher: typeof fetch, wait?: Wait): Promise<string> {
  let res: Response;
  try {
    res = await fetchPatiently(url, { headers: { accept: "application/json" } }, fetcher, wait);
  } catch (error) {
    throw new Error(`The content at ${url} could not be reached: ${String(error)}`, {
      cause: error,
    });
  }
  if (!res.ok) throw new Error(`The content at ${url} answered ${res.status}: ${await res.text()}`);
  return res.text();
}

export async function readContent(
  source: ContentSource,
  fetcher: typeof fetch = fetch,
  wait?: Wait,
): Promise<LoadedContent> {
  const base = source.kind === "url" ? new URL(source.url) : pathToFileURL(resolve(source.path));
  const text =
    source.kind === "url"
      ? await fetchText(source.url, fetcher, wait)
      : await readFile(base, "utf8");
  const parsed = contentDocument.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`The content at ${base.href} breaks the schema: ${parsed.error.message}`);
  }
  return { content: parsed.data, mediaUrl: (key) => new URL(`media/${key}`, base) };
}

const SHARED = Symbol.for("rupeefund.content");

type Shared = typeof globalThis & { [SHARED]?: Map<string, Promise<LoadedContent>> };

export function sharedContent(
  source: ContentSource,
  fetcher: typeof fetch = fetch,
): Promise<LoadedContent> {
  const cache = ((globalThis as Shared)[SHARED] ??= new Map());
  const key = source.kind === "url" ? source.url : resolve(source.path);
  let loaded = cache.get(key);
  if (!loaded) {
    loaded = readContent(source, fetcher);
    cache.set(key, loaded);
  }
  return loaded;
}

export function loadContent(): Promise<LoadedContent> {
  return sharedContent(contentSource(process.env));
}

export function newestFirst<T extends { publishedAt: string }>(posts: readonly T[]): T[] {
  return posts.toSorted((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
