import { readdirSync } from "node:fs";
import { PAGES, POST_SLUGS } from "../fixtures/content.ts";

export const posts = POST_SLUGS.map((slug) => `/blog/${slug}`);
export const pages = PAGES.map(({ slug }) => `/${slug}`);
export const routes = [
  ...readdirSync("src/pages")
    .filter((file) => file.endsWith(".astro") && !file.startsWith("["))
    .map((file) => (file === "index.astro" ? "/" : `/${file.slice(0, -6)}`)),
  ...pages,
  ...posts,
];
