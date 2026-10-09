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
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const slug = z.string().regex(SLUG);
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

export const SEASON_NAMES = ["Winter", "Summer", "Monsoon", "Post-monsoon"] as const;

export const PAGE_KINDS = ["page", "legal"] as const;

export const post = z.object({
  slug,
  title: text,
  excerpt: text,
  image: image.optional(),
  body: portableText,
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
  category: text.default("Blog"),
  season: z.object({ name: z.enum(SEASON_NAMES), year: z.number().int() }).optional(),
  authors: z.array(text).default([]),
});

export const faqEntry = z.object({
  slug,
  question: text,
  answer: portableText.min(1),
  order: z.number().int(),
  home: z.boolean(),
  sources: z.array(z.object({ title: text, url: href })),
});

export const landing = z.object({
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
});

export const peoplePage = z.object({
  teamTitle: text,
  teamIntro: text,
  joinTitle: text,
  joinBody: text,
  foundationTitle: text,
  foundationBody: oneParagraph,
});

export const person = z.object({
  slug,
  name: text,
  bio: text.optional(),
  profileUrl: href.optional(),
  username: text.optional(),
  photoUrl: photoUrl.optional(),
  order: z.number().int(),
});

export const page = z.object({
  slug,
  title: text,
  kind: z.enum(PAGE_KINDS).default("page"),
  effectiveDate: text.optional(),
  body: portableText.min(1),
});

export type Post = z.output<typeof post>;
export type FaqEntry = z.output<typeof faqEntry>;
export type Landing = z.output<typeof landing>;
export type PeoplePage = z.output<typeof peoplePage>;
export type Person = z.output<typeof person>;
export type Page = z.output<typeof page>;
export type PortableText = z.input<typeof portableText>;
export type Image = z.output<typeof image>;
