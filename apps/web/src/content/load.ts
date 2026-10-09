import { getEmDashCollection, getEmDashEntry } from "emdash";
import {
  ContentError,
  toFaq,
  toPage,
  toPages,
  toPeople,
  toPeoplePage,
  toPost,
  toPosts,
  valid,
  type Entry,
} from "./entries.ts";
import {
  SLUG,
  type FaqEntry,
  type Page,
  type PeoplePage,
  type Person,
  type Post,
} from "./schema.ts";

export const PEOPLE_PAGE_SLUG = "people";

const asEntry = (entry: { id: string; data: unknown }): Entry => ({
  slug: entry.id,
  data: { ...(entry.data as Record<string, unknown>) },
});

function checked<T>(entry: Entry | null, map: (entry: Entry) => T): T | null {
  const [content] = entry ? valid([entry], map) : [];
  return content ?? null;
}

async function published(collection: string): Promise<Entry[]> {
  const entries: Entry[] = [];
  let cursor: string | undefined;
  do {
    const batch = await getEmDashCollection(collection, {
      status: "published",
      limit: 100,
      cursor,
    });
    if (batch.error) throw batch.error;
    entries.push(...batch.entries.map(asEntry));
    cursor = batch.nextCursor;
  } while (cursor);
  return entries;
}

async function one(collection: string, slug: string): Promise<Entry | null> {
  if (!SLUG.test(slug)) return null;
  const { entry, error } = await getEmDashEntry(collection, slug);
  if (error) throw error;
  return entry ? asEntry(entry) : null;
}

async function required(collection: string, slug: string): Promise<Entry> {
  const entry = await one(collection, slug);
  if (entry) return entry;
  const [first] = await published(collection);
  if (!first) throw new ContentError(`Publish the ${collection} entry`);
  console.warn(`No ${collection} entry has the slug ${slug}. The site shows ${first.slug}.`);
  return first;
}

export const posts = async (): Promise<Post[]> => toPosts(await published("posts"));

export const faq = async (): Promise<FaqEntry[]> => toFaq(await published("faq"));

export const pages = async (): Promise<Page[]> => toPages(await published("pages"));

export const people = async (): Promise<Person[]> => toPeople(await published("people"));

export const post = async (slug: string): Promise<Post | null> =>
  checked(await one("posts", slug), toPost);

export const page = async (slug: string): Promise<Page | null> =>
  checked(await one("pages", slug), toPage);

export const peoplePageContent = async (): Promise<PeoplePage> =>
  toPeoplePage((await required("people_page", PEOPLE_PAGE_SLUG)).data);
