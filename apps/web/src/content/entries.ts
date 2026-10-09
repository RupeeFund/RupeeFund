import type { z } from "zod";
import {
  faqEntry,
  landing,
  page,
  peoplePage,
  person,
  post,
  type FaqEntry,
  type Image,
  type Landing,
  type Page,
  type PeoplePage,
  type Person,
  type Post,
} from "./schema.ts";

export interface Entry {
  slug: string;
  data: Record<string, unknown>;
}

export class ContentError extends Error {}

const LOCAL_MEDIA = /^\/_emdash\/api\/media\/file\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null;

function storageKey(asset: Raw, where: string): string {
  if (typeof asset.provider === "string" && asset.provider !== "local") {
    throw new ContentError(`${where}: upload the image to the media library`);
  }
  const meta = isRecord(asset.meta) ? asset.meta : {};
  if (typeof meta.storageKey === "string") return meta.storageKey;
  for (const url of [asset.url, asset.src]) {
    const match = typeof url === "string" ? LOCAL_MEDIA.exec(url) : null;
    if (match?.[1]) return match[1];
  }
  throw new ContentError(`${where}: the image has no file in the media library`);
}

function toImage(value: Raw, asset: Raw, where: string): Image {
  const meta = isRecord(asset.meta) ? asset.meta : {};
  const caption = value.caption ?? meta.caption;
  const width = value.width ?? asset.width;
  const height = value.height ?? asset.height;
  return {
    src: `/media/${storageKey(asset, where)}`,
    alt: typeof value.alt === "string" ? value.alt : typeof asset.alt === "string" ? asset.alt : "",
    ...(typeof width === "number" ? { width } : {}),
    ...(typeof height === "number" ? { height } : {}),
    ...(typeof caption === "string" && caption ? { caption } : {}),
  };
}

const REFUSED: Record<string, string> = {
  iframe: "embed",
  htmlBlock: "raw HTML",
  gallery: "gallery",
  reference: "reference",
};

function portableText(value: unknown, where: string): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((block: unknown) => {
    const refused = isRecord(block) && typeof block._type === "string" && REFUSED[block._type];
    if (refused) {
      throw new ContentError(`${where}: remove the ${refused}. The site does not show it.`);
    }
    if (!isRecord(block) || block._type !== "image") return block;
    const asset = isRecord(block.asset) ? block.asset : {};
    return { _type: "image", ...toImage(block, asset, where) };
  });
}

const BOLD_RUN = /\*\*(.+?)\*\*/gs;

const span = (text: string, marks: string[]) => ({ _type: "span", text, marks });

function paragraphFrom(text: unknown): unknown {
  if (typeof text !== "string") return text;
  const children: ReturnType<typeof span>[] = [];
  let at = 0;
  for (const run of text.matchAll(BOLD_RUN)) {
    if (run.index > at) children.push(span(text.slice(at, run.index), []));
    children.push(span(run[1]!, ["strong"]));
    at = run.index + run[0].length;
  }
  if (at < text.length || children.length === 0) children.push(span(text.slice(at), []));
  return [{ _type: "block", style: "normal", markDefs: [], children }];
}

const isoDate = (value: unknown) => (value instanceof Date ? value.toISOString() : value);

function authors(bylines: unknown): string[] {
  if (!Array.isArray(bylines)) return [];
  return bylines.flatMap((credit: unknown) => {
    const byline = isRecord(credit) && isRecord(credit.byline) ? credit.byline : {};
    return typeof byline.displayName === "string" && byline.displayName ? [byline.displayName] : [];
  });
}

function category(data: Raw): unknown {
  const terms =
    isRecord(data.terms) && Array.isArray(data.terms.category) ? data.terms.category : [];
  const [term] = terms.filter(isRecord);
  return typeof term?.label === "string" && term.label ? term.label : undefined;
}

function season(data: Raw): { name: unknown; year: unknown } | undefined {
  if (typeof data.season !== "string" || !data.season) return undefined;
  const published = isoDate(data.publishedAt);
  const year =
    typeof data.season_year === "number"
      ? data.season_year
      : typeof published === "string"
        ? Number(published.slice(0, 4)) -
          (data.season === "Winter" && published.slice(5, 7) < "03" ? 1 : 0)
        : undefined;
  return { name: data.season, year };
}

function parsed<S extends z.ZodType>(schema: S, value: unknown, where: string): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ContentError(`${where}: ${result.error.message}`);
  return result.data;
}

const orderOf = ({ data }: Entry) =>
  data.order === null || data.order === undefined ? Number.POSITIVE_INFINITY : Number(data.order);

const publishedOf = ({ data }: Entry) => String(isoDate(data.publishedAt) ?? "");

const byOrder = (a: Entry, b: Entry): number =>
  orderOf(a) - orderOf(b) || publishedOf(a).localeCompare(publishedOf(b));

export function valid<T>(entries: Entry[], map: (entry: Entry) => T): T[] {
  return entries.flatMap((entry) => {
    try {
      return [map(entry)];
    } catch (error) {
      if (!(error instanceof ContentError)) throw error;
      console.error(`The site leaves out an entry: ${error.message}`);
      return [];
    }
  });
}

function ordered<T extends { order: number }>(entries: Entry[], map: (entry: Entry) => T): T[] {
  return valid(entries.toSorted(byOrder), map).map((item, index) => ({
    ...item,
    order: index + 1,
  }));
}

export function newestFirst<T extends { publishedAt: string }>(list: readonly T[]): T[] {
  return list.toSorted((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function toPost({ slug, data }: Entry): Post {
  const where = `posts/${slug}`;
  const postSeason = season(data);
  return parsed(
    post,
    {
      slug,
      title: data.title,
      excerpt: data.excerpt,
      ...(isRecord(data.featured_image)
        ? { image: toImage(data.featured_image, data.featured_image, where) }
        : {}),
      body: portableText(data.content, where),
      publishedAt: isoDate(data.publishedAt),
      ...(data.updatedAt ? { updatedAt: isoDate(data.updatedAt) } : {}),
      category: category(data),
      ...(postSeason ? { season: postSeason } : {}),
      authors: authors(data.bylines),
    },
    where,
  );
}

function toFaqEntry({ slug, data }: Entry): FaqEntry {
  const where = `faq/${slug}`;
  return parsed(
    faqEntry,
    {
      slug,
      question: data.title,
      answer: portableText(data.answer, where),
      order: 0,
      home: data.home === true,
      sources: data.sources ?? [],
    },
    where,
  );
}

export function toLanding(data: Raw): Landing {
  return parsed(
    landing,
    {
      heroLede: data.hero_lede,
      pitchTitle: data.pitch_title,
      pitchBody: portableText(data.pitch_body, "landing"),
      pitchSourceTitle: data.pitch_source_title,
      pitchSourceUrl: data.pitch_source_url,
      stepsTitle: data.steps_title,
      steps: Array.isArray(data.steps)
        ? data.steps.map((step: unknown) => {
            const fields = isRecord(step) ? step : {};
            return { title: fields.title, body: paragraphFrom(fields.body) };
          })
        : data.steps,
      seasonsTitle: data.seasons_title,
      why: data.why,
      faqTitle: data.faq_title,
    },
    "landing",
  );
}

export function toPeoplePage(data: Raw): PeoplePage {
  return parsed(
    peoplePage,
    {
      teamTitle: data.team_title,
      teamIntro: data.team_intro,
      joinTitle: data.join_title,
      joinBody: data.join_body,
      foundationTitle: data.foundation_title,
      foundationBody: portableText(data.foundation_body, "people page"),
    },
    "people page",
  );
}

function toPerson({ slug, data }: Entry): Person {
  return parsed(
    person,
    {
      slug,
      name: data.title,
      bio: data.bio || undefined,
      profileUrl: data.profile_url || undefined,
      username: data.username || undefined,
      photoUrl: data.photo_url || undefined,
      order: 0,
    },
    `people/${slug}`,
  );
}

export function toPage({ slug, data }: Entry): Page {
  const where = `pages/${slug}`;
  return parsed(
    page,
    {
      slug,
      title: data.title,
      kind: data.kind || undefined,
      effectiveDate: data.effective_date || undefined,
      body: portableText(data.content, where),
    },
    where,
  );
}

export const toPosts = (entries: Entry[]): Post[] => newestFirst(valid(entries, toPost));

export const toFaq = (entries: Entry[]): FaqEntry[] => ordered(entries, toFaqEntry);

export const toPeople = (entries: Entry[]): Person[] => ordered(entries, toPerson);

export const toPages = (entries: Entry[]): Page[] => valid(entries, toPage);
