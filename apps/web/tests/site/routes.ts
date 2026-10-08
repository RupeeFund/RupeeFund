import { DRAFT_SLUGS, MEDIA, PAGES, POST_SLUGS } from "../fixtures/content.ts";

export const RENDERED = "dist-preview/rendered";

export const ROUTES: readonly string[] = [
  "/",
  "/subscribe",
  "/waitlist-confirmed",
  "/faq",
  "/people",
  "/blog",
  "/blog/rss.xml",
  "/sitemap.xml",
  "/robots.txt",
  "/404",
  ...PAGES.map(({ slug }) => `/${slug}`),
  ...POST_SLUGS.map((slug) => `/blog/${slug}`),
];

export const MISSING: readonly string[] = [
  "/no-such-page",
  "/blog/no-such-post",
  "/a/b",
  "/Privacy",
  "/media/01M42NONE0000000000000000.jpg",
  "/media/x.svg",
  "/media/a/b.jpg",
  ...DRAFT_SLUGS.map((slug) => `/blog/${slug}`),
];

export const MEDIA_ROUTES: readonly string[] = MEDIA.map((file) => `/media/${file}`);

export const fileFor = (route: string): string =>
  route === "/" ? "index.html" : /\.\w+$/.test(route) ? route.slice(1) : `${route.slice(1)}.html`;
