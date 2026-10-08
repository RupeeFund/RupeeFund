import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { posts } from "../../content/load.ts";
import { SITE_NAME, SITE_URL } from "../../lib/seo.ts";

export const GET: APIRoute = async () =>
  rss({
    title: SITE_NAME,
    description: `News and updates from ${SITE_NAME}.`,
    site: SITE_URL,
    trailingSlash: false,
    items: (await posts()).map((post) => ({
      title: post.title,
      description: post.excerpt,
      link: `/blog/${post.slug}`,
      pubDate: new Date(post.publishedAt),
    })),
  });
