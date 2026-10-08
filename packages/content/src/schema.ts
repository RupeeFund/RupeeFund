import { z } from "zod";

export function isSafeHref(href: string): boolean {
  if ([...href].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) {
    return false;
  }
  if (href.startsWith("/")) return !/^\/[\\/]/.test(href);
  return href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("#");
}

const PHOTO_HOSTS = new Set(["github.com", "avatars.githubusercontent.com"]);

const href = z.string().refine(isSafeHref, "Use an https:, mailto: or site-relative link");
export const MEDIA_FILE = /^[A-Za-z0-9][A-Za-z0-9_-]*\.(?:png|jpe?g|gif|webp|avif)$/i;

const mediaSrc = z
  .string()
  .refine(
    (src) => src.startsWith("/media/") && MEDIA_FILE.test(src.slice(7)),
    "Use a PNG, JPEG, GIF, WebP or AVIF image from the media library",
  );
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const photoUrl = z
  .string()
  .refine(
    (url) =>
      url.startsWith("https://") && URL.canParse(url) && PHOTO_HOSTS.has(new URL(url).hostname),
    {
      message: "Host the photo on GitHub, the one photo host the site policy allows",
    },
  );

const DECORATORS = new Set([
  "strong",
  "em",
  "code",
  "underline",
  "strike-through",
  "subscript",
  "superscript",
]);

const span = z.object({
  _type: z.literal("span"),
  text: z.string(),
  marks: z.array(z.string()).default([]),
});

const linkDefs = z
  .array(z.object({ _key: z.string(), _type: z.literal("link"), href }))
  .default([]);

const knownMarks = (spans: { marks: string[] }[], defs: { _key: string }[]) => {
  const links = new Set(defs.map((def) => def._key));
  return spans.every((child) =>
    child.marks.every((mark) => DECORATORS.has(mark) || links.has(mark)),
  );
};

const UNKNOWN_MARK = { message: "A mark is neither a decorator nor a link" };

const textBlock = z
  .object({
    _type: z.literal("block"),
    style: z.enum(["normal", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]).default("normal"),
    listItem: z.enum(["bullet", "number"]).optional(),
    level: z.number().int().positive().optional(),
    markDefs: linkDefs,
    children: z.array(span),
  })
  .refine((block) => knownMarks(block.children, block.markDefs), UNKNOWN_MARK);

export const image = z.object({
  src: mediaSrc,
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  caption: z.string().optional(),
});

const imageBlock = image.extend({ _type: z.literal("image") });

const codeBlock = z.object({
  _type: z.literal("code"),
  code: z.string(),
  language: z.string().optional(),
});

const divider = z.object({ _type: z.literal("break"), style: z.string().optional() });

const tableCell = z.object({
  _type: z.literal("tableCell"),
  isHeader: z.boolean().optional(),
  colspan: z.number().int().positive().optional(),
  rowspan: z.number().int().positive().optional(),
  markDefs: linkDefs,
  content: z.array(span),
});

const table = z
  .object({
    _type: z.literal("table"),
    hasHeaderRow: z.boolean().optional(),
    markDefs: linkDefs,
    rows: z.array(z.object({ _type: z.literal("tableRow"), cells: z.array(tableCell) })),
  })
  .refine(
    (value) =>
      value.rows.every((row) =>
        row.cells.every((cell) => knownMarks(cell.content, [...value.markDefs, ...cell.markDefs])),
      ),
    UNKNOWN_MARK,
  );

const refused = z
  .object({ _type: z.enum(["iframe", "htmlBlock"]) })
  .refine(() => false, "The site does not show embeds or raw HTML. Remove the block.");

const paragraph = textBlock.refine((block) => block.style === "normal" && !block.listItem, {
  message: "Use a plain paragraph here: no heading, list or quote",
});

const paragraphs = z.array(paragraph).min(1);

const oneParagraph = z.array(paragraph).length(1, "Use one paragraph here");

const uniqueSlugs = <T extends { slug: string }>(entries: T[]) =>
  new Set(entries.map((entry) => entry.slug)).size === entries.length;

const UNIQUE_SLUGS = { message: "Give each entry its own slug" };

const text = z.string().trim().min(1);

const callout = z.object({
  _type: z.literal("callout"),
  tone: z.enum(["note", "highlight"]).default("note"),
  text,
});

const quote = z.object({
  _type: z.literal("quote"),
  text,
  attribution: z.string().trim().optional(),
});

const callToAction = z.object({
  _type: z.literal("cta"),
  label: text,
  url: z.string().refine(isSafeHref, "Use a link to this site or an https address"),
});

export const portableText = z.array(
  z.union([
    textBlock,
    imageBlock,
    codeBlock,
    divider,
    table,
    callout,
    quote,
    callToAction,
    refused,
  ]),
);

export const POST_KINDS = ["Update", "Season report", "Essay", "Guide"] as const;

export const SEASON_NAMES = ["Winter", "Summer", "Monsoon", "Post-monsoon"] as const;

export const POLICY_SLUGS = ["privacy", "terms", "refunds", "code-of-conduct"] as const;

export const contentDocument = z.object({
  version: z.literal(1),
  posts: z
    .array(
      z.object({
        slug,
        title: text,
        excerpt: text,
        image: image.optional(),
        body: portableText,
        publishedAt: z.iso.datetime(),
        updatedAt: z.iso.datetime().optional(),
        kind: z.enum(POST_KINDS).default("Update"),
        season: z.object({ name: z.enum(SEASON_NAMES), year: z.number().int() }).optional(),
        authors: z.array(text).default([]),
      }),
    )
    .refine(uniqueSlugs, UNIQUE_SLUGS),
  faq: z
    .array(
      z.object({
        slug,
        question: text,
        answer: portableText.min(1),
        order: z.number().int(),
        home: z.boolean(),
        sources: z.array(z.object({ title: text, url: href })),
      }),
    )
    .min(1)
    .refine(uniqueSlugs, UNIQUE_SLUGS),
  home: z.object({
    heroLede: text,
    pitchTitle: text,
    pitchBody: paragraphs,
    pitchSourceTitle: text,
    pitchSourceUrl: href,
    stepsTitle: text,
    steps: z.array(z.object({ title: text, body: oneParagraph })).min(1),
    seasonsTitle: text,
    why: z.array(z.object({ title: text, body: text })).min(1),
    faqTitle: text,
  }),
  peoplePage: z.object({
    teamTitle: text,
    teamIntro: text,
    joinTitle: text,
    joinBody: text,
    foundationTitle: text,
    foundationBody: oneParagraph,
  }),
  people: z
    .array(
      z.object({
        slug,
        name: text,
        bio: text.optional(),
        profileUrl: href.optional(),
        username: text.optional(),
        photoUrl: photoUrl.optional(),
        order: z.number().int(),
      }),
    )
    .refine(uniqueSlugs, UNIQUE_SLUGS),
  policies: z
    .array(
      z.object({
        slug: z.enum(POLICY_SLUGS),
        title: text,
        effectiveDate: text,
        body: portableText.min(1),
      }),
    )
    .refine(
      (policies) =>
        POLICY_SLUGS.every((name) => policies.filter((p) => p.slug === name).length === 1),
      { message: `Publish each policy once: ${POLICY_SLUGS.join(", ")}` },
    ),
});

export type ContentDocument = z.input<typeof contentDocument>;
export type Content = z.output<typeof contentDocument>;
export type PortableText = z.input<typeof portableText>;
export type Image = z.output<typeof image>;
