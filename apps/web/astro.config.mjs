import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { d1, r2 } from "@emdash-cms/cloudflare";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";
import { loadContent } from "./src/build/content.ts";
import { copyMedia } from "./src/build/media.ts";
import { writeSiteCard } from "./src/build/og.ts";
import { isListed, SITE_URL } from "./src/lib/seo.ts";

const cmsMedia = {
  name: "cms-media",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      await copyMedia(await loadContent(), fileURLToPath(dir));
    },
  },
};

const PUBLISHED = "virtual:cms-content";

const publishedContent = {
  name: "published-content",
  resolveId: (id) => (id === PUBLISHED ? `\0${PUBLISHED}` : undefined),
  load: async (id) =>
    id === `\0${PUBLISHED}`
      ? `export default ${JSON.stringify((await loadContent()).content)};`
      : undefined,
};

const ogCard = {
  name: "og-card",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      await writeSiteCard(fileURLToPath(dir));
    },
  },
};

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "never",
  build: {
    format: "file",
  },
  adapter: cloudflare({
    imageService: "passthrough",
    persistState: { path: "../../.wrangler/state" },
  }),
  integrations: [
    cmsMedia,
    ogCard,
    react(),
    emdash({
      database: d1({ binding: "DB" }),
      storage: r2({ binding: "MEDIA" }),
      siteUrl: SITE_URL,
      mcp: false,
      plugins: [
        {
          id: "rupeefund-site",
          version: "1.0.0",
          format: "native",
          entrypoint: "@rupeefund/cms/plugin",
        },
      ],
    }),
    sitemap({
      // isListed reads the one table that also drives the `noindex` meta tag,
      // so a page cannot be excluded from one and not the other.
      filter: (page) => isListed(new URL(page).pathname),
    }),
  ],
  server: { port: Number(process.env.PORT ?? 8787) },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss(), publishedContent],
  },
});
