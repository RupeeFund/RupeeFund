import type { APIRoute } from "astro";
import { pages, posts } from "../content/load.ts";
import { blogPaths, FIXED_PATHS, sitemapXml } from "../lib/sitemap.ts";

export const GET: APIRoute = async () => {
  const [entries, articles] = await Promise.all([pages(), posts()]);
  const paths = [
    ...FIXED_PATHS,
    ...entries.map(({ slug }) => `/${slug}`),
    ...blogPaths(articles.map(({ slug }) => slug)),
  ];
  return new Response(sitemapXml(paths), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
