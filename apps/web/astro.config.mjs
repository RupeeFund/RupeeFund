import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath } from "node:url";
import { loadContent } from "./src/build/content.ts";
import { copyMedia } from "./src/build/media.ts";
import { isListed, SITE_URL } from "./src/lib/seo.ts";

const cmsMedia = {
  name: "cms-media",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      await copyMedia(await loadContent(), fileURLToPath(dir));
    },
  },
};

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "never",
  build: {
    format: "file",
  },
  integrations: [
    cmsMedia,
    sitemap({
      // isListed reads the one table that also drives the `noindex` meta tag,
      // so a page cannot be excluded from one and not the other.
      filter: (page) => isListed(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
