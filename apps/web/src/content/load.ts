import { getEmDashCollection, getEmDashEntry, getMenu } from "emdash";
import {
  ContentError,
  toFaq,
  toLanding,
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
  isSafeHref,
  SLUG,
  type FaqEntry,
  type Landing,
  type Page,
  type PeoplePage,
  type Person,
  type Post,
} from "./schema.ts";

export const LANDING_SLUG = "landing";
export const PEOPLE_PAGE_SLUG = "people";

export interface MenuLink {
  label: string;
  href: string;
}

const asEntry = (entry: { id: string; data: unknown }): Entry => ({
  slug: entry.id,
  data: { ...(entry.data as Record<string, unknown>) },
});

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

export async function post(slug: string): Promise<Post | null> {
  const entry = await one("posts", slug);
  return entry ? (valid([entry], toPost)[0] ?? null) : null;
}

export async function page(slug: string): Promise<Page | null> {
  const entry = await one("pages", slug);
  return entry ? (valid([entry], toPage)[0] ?? null) : null;
}

export const landingContent = async (): Promise<Landing> =>
  toLanding((await required("landing", LANDING_SLUG)).data);

export const peoplePageContent = async (): Promise<PeoplePage> =>
  toPeoplePage((await required("people_page", PEOPLE_PAGE_SLUG)).data);

export async function menu(name: "primary" | "footer"): Promise<MenuLink[]> {
  try {
    const found = await getMenu(name);
    return (found?.items ?? [])
      .filter(({ url }) => isSafeHref(url))
      .map(({ label, url }) => ({ label, href: url }));
  } catch (error) {
    console.error(`The site shows the ${name} menu empty: ${String(error)}`);
    return [];
  }
}
