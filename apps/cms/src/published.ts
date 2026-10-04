import { contentDocument, type Content, type Image } from "@rupeefund/content/schema";

export interface Entry {
  slug: string;
  data: Record<string, unknown>;
}

export type Collections = Record<
  "posts" | "faq" | "home" | "people_page" | "people" | "policies",
  Entry[]
>;

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
  const width = value.width ?? asset.width;
  const height = value.height ?? asset.height;
  return {
    src: `/media/${storageKey(asset, where)}`,
    alt: typeof value.alt === "string" ? value.alt : typeof asset.alt === "string" ? asset.alt : "",
    ...(typeof width === "number" ? { width } : {}),
    ...(typeof height === "number" ? { height } : {}),
  };
}

function portableText(value: unknown, where: string): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((block: unknown) => {
    if (!isRecord(block) || block._type !== "image") return block;
    const asset = isRecord(block.asset) ? block.asset : {};
    return { _type: "image", ...toImage(block, asset, where) };
  });
}

const byOrder = (a: Entry, b: Entry) => Number(a.data.order) - Number(b.data.order);

function only(entries: Entry[], name: string): Raw {
  const [entry] = entries;
  if (!entry) throw new ContentError(`Publish the ${name}`);
  return entry.data;
}

export function buildDocument(collections: Collections): Content {
  const home = only(collections.home, "home page");
  const peoplePage = only(collections.people_page, "people page");
  const document = {
    version: 1,
    posts: collections.posts.map(({ slug, data }) => ({
      slug,
      title: data.title,
      excerpt: data.excerpt,
      ...(isRecord(data.featured_image)
        ? { image: toImage(data.featured_image, data.featured_image, `posts/${slug}`) }
        : {}),
      body: portableText(data.content, `posts/${slug}`),
      publishedAt:
        data.publishedAt instanceof Date ? data.publishedAt.toISOString() : data.publishedAt,
    })),
    faq: collections.faq.toSorted(byOrder).map(({ slug, data }) => ({
      slug,
      question: data.title,
      answer: portableText(data.answer, `faq/${slug}`),
      order: data.order,
      home: data.home === true,
      sources: data.sources ?? [],
    })),
    home: {
      heroLede: home.hero_lede,
      pitchTitle: home.pitch_title,
      pitchBody: portableText(home.pitch_body, "home"),
      pitchSourceTitle: home.pitch_source_title,
      pitchSourceUrl: home.pitch_source_url,
      stepsTitle: home.steps_title,
      steps: Array.isArray(home.steps)
        ? home.steps.map((step: Raw) => ({
            title: step.title,
            body: portableText(step.body, "home"),
          }))
        : home.steps,
      seasonsTitle: home.seasons_title,
      why: home.why,
      faqTitle: home.faq_title,
    },
    peoplePage: {
      teamTitle: peoplePage.team_title,
      teamIntro: peoplePage.team_intro,
      joinTitle: peoplePage.join_title,
      joinBody: peoplePage.join_body,
      foundationTitle: peoplePage.foundation_title,
      foundationBody: portableText(peoplePage.foundation_body, "people page"),
    },
    people: collections.people.toSorted(byOrder).map(({ slug, data }) => ({
      slug,
      name: data.title,
      bio: data.bio || undefined,
      profileUrl: data.profile_url || undefined,
      username: data.username || undefined,
      photoUrl: data.photo_url || undefined,
      order: data.order,
    })),
    policies: collections.policies.map(({ slug, data }) => ({
      slug,
      title: data.title,
      effectiveDate: data.effective_date,
      body: portableText(data.content, `policies/${slug}`),
    })),
  };
  const parsed = contentDocument.safeParse(document);
  if (!parsed.success) throw new ContentError(parsed.error.message);
  return parsed.data;
}
