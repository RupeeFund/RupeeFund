import { z } from "zod";

export function isSafeHref(href: string): boolean {
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
  .refine((url) => url.startsWith("https://") && PHOTO_HOSTS.has(new URL(url).hostname), {
    message: "Host the photo on GitHub, the one photo host the site policy allows",
  });

const DECORATORS = new Set(["strong", "em", "code", "underline", "strike-through"]);

const span = z.object({
  _type: z.literal("span"),
  text: z.string(),
  marks: z.array(z.string()).default([]),
});

const textBlock = z
  .object({
    _type: z.literal("block"),
    style: z.enum(["normal", "h2", "h3", "h4", "blockquote"]).default("normal"),
    listItem: z.enum(["bullet", "number"]).optional(),
    level: z.number().int().positive().optional(),
    markDefs: z.array(z.object({ _key: z.string(), _type: z.literal("link"), href })).default([]),
    children: z.array(span),
  })
  .refine(
    (block) => {
      const links = new Set(block.markDefs.map((def) => def._key));
      return block.children.every((child) =>
        child.marks.every((mark) => DECORATORS.has(mark) || links.has(mark)),
      );
    },
    { message: "A mark is neither a decorator nor a link" },
  );

export const image = z.object({
  src: mediaSrc,
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const imageBlock = image.extend({ _type: z.literal("image") });

export const portableText = z.array(z.union([textBlock, imageBlock]));

const text = z.string().min(1);

export const POLICY_SLUGS = ["privacy", "terms", "refunds", "code-of-conduct"] as const;

export const contentDocument = z.object({
  version: z.literal(1),
  posts: z.array(
    z.object({
      slug,
      title: text,
      excerpt: text,
      image: image.optional(),
      body: portableText,
      publishedAt: z.iso.datetime(),
    }),
  ),
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
    .min(1),
  home: z.object({
    heroLede: text,
    pitchTitle: text,
    pitchBody: portableText.min(1),
    pitchSourceTitle: text,
    pitchSourceUrl: href,
    stepsTitle: text,
    steps: z.array(z.object({ title: text, body: portableText.min(1) })).min(1),
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
    foundationBody: portableText.min(1),
  }),
  people: z.array(
    z.object({
      slug,
      name: text,
      bio: text.optional(),
      profileUrl: href.optional(),
      username: text.optional(),
      photoUrl: photoUrl.optional(),
      order: z.number().int(),
    }),
  ),
  policies: z
    .array(
      z.object({
        slug: z.enum(POLICY_SLUGS),
        title: text,
        effectiveDate: text,
        body: portableText.min(1),
      }),
    )
    .refine((policies) => POLICY_SLUGS.every((name) => policies.some((p) => p.slug === name)), {
      message: `Publish every policy: ${POLICY_SLUGS.join(", ")}`,
    }),
});

export type ContentDocument = z.input<typeof contentDocument>;
export type Content = z.output<typeof contentDocument>;
export type PortableText = z.input<typeof portableText>;
export type Image = z.output<typeof image>;
