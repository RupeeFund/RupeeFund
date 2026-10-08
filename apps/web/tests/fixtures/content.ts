import { readdirSync, readFileSync } from "node:fs";

interface SeedEntry {
  slug: string;
  status: string;
  data: Record<string, unknown>;
}

const seed = JSON.parse(readFileSync("seed/seed.json", "utf8")) as {
  content: Record<string, SeedEntry[]>;
};

const fixture = JSON.parse(readFileSync("tests/fixtures/content/posts.json", "utf8")) as {
  posts: SeedEntry[];
};

const entries = (collection: string): SeedEntry[] => seed.content[collection] ?? [];

const slugsWith = (status: string): string[] =>
  fixture.posts.filter((post) => post.status === status).map(({ slug }) => slug);

export const POST_SLUGS: readonly string[] = slugsWith("published");

export const DRAFT_SLUGS: readonly string[] = slugsWith("draft");

export const PAGES = entries("pages").map(({ slug, data }) => ({
  slug,
  title: String(data.title),
  kind: String(data.kind),
  effectiveDate: typeof data.effective_date === "string" ? data.effective_date : undefined,
}));

export const FAQ = entries("faq").map(({ slug, data }) => ({
  slug,
  question: String(data.title),
  order: Number(data.order),
  home: data.home === true,
}));

export const PEOPLE = entries("people").map(({ slug, data }) => ({
  slug,
  photoUrl: typeof data.photo_url === "string" && data.photo_url ? data.photo_url : undefined,
}));

export const MEDIA: readonly string[] = readdirSync("tests/fixtures/content/media");
