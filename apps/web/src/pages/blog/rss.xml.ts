import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { newestFirst } from "../../build/content.ts";
import { content } from "../../build/published.ts";
import { SITE_NAME, SITE_URL } from "../../lib/seo.ts";

export const GET: APIRoute = async () => {
  return rss({
    title: SITE_NAME,
    description: `News and updates from ${SITE_NAME}.`,
    site: SITE_URL,
    trailingSlash: false,
    items: newestFirst(content.posts).map((post) => ({
      title: post.title,
      description: post.excerpt,
      link: `/blog/${post.slug}`,
      pubDate: new Date(post.publishedAt),
    })),
  });
};
