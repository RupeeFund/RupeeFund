import { isListed, SITE_URL } from "./seo.ts";

export const FIXED_PATHS: readonly string[] = [
  "/",
  "/subscribe",
  "/faq",
  "/people",
  "/waitlist-confirmed",
];

export const blogPaths = (slugs: readonly string[]): string[] =>
  slugs.length > 0 ? ["/blog", ...slugs.map((slug) => `/blog/${slug}`)] : [];

export function sitemapXml(paths: readonly string[]): string {
  const urls = paths
    .filter(isListed)
    .map((path) => `<url><loc>${path === "/" ? SITE_URL : `${SITE_URL}${path}`}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`,
  ].join("\n");
}
