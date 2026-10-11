import { isListed, SITE_URL } from "./seo.ts";

export const FIXED_PATHS: readonly string[] = [
  "/",
  "/subscribe",
  "/faq",
  "/people",
  "/waitlist-confirmed",
];

export interface SitemapEntry {
  readonly path: string;
  readonly lastmod?: string;
}

interface DatedPost {
  readonly slug: string;
  readonly publishedAt: string;
  readonly updatedAt?: string;
}

export const blogPaths = (posts: readonly DatedPost[]): SitemapEntry[] =>
  posts.length > 0
    ? [
        { path: "/blog" },
        ...posts.map(({ slug, publishedAt, updatedAt }) => ({
          path: `/blog/${slug}`,
          lastmod: updatedAt ?? publishedAt,
        })),
      ]
    : [];

const urlOf = ({ path, lastmod }: SitemapEntry): string => {
  const loc = `<loc>${path === "/" ? SITE_URL : `${SITE_URL}${path}`}</loc>`;
  return `<url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
};

export function sitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.filter(({ path }) => isListed(path)).map(urlOf);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`,
  ].join("\n");
}
