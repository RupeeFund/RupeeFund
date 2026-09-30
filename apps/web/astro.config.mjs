import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { NON_INDEXABLE_PATHS, SITE_URL } from "./src/lib/seo.ts";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "never",
  build: {
    format: "file",
  },
  integrations: [
    sitemap({
      // NON_INDEXABLE_PATHS is derived from the one table that also drives the
      // `noindex` meta tag, so a page cannot be excluded from one and not the other.
      filter: (page) => !NON_INDEXABLE_PATHS.includes(new URL(page).pathname.replace(/\/$/, "")),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
