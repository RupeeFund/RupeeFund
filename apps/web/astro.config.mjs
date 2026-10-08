import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { d1, r2 } from "@emdash-cms/cloudflare";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";
import { writeSiteCard } from "./src/build/og.ts";
import { SITE_URL } from "./src/lib/seo.ts";

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
  output: "server",
  trailingSlash: "never",
  build: {
    format: "file",
  },
  adapter: cloudflare({
    imageService: "passthrough",
    persistState: { path: "../../.wrangler/state" },
  }),
  integrations: [
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
          version: "2.0.0",
          format: "native",
          entrypoint: "@rupeefund/web/plugin",
        },
      ],
    }),
  ],
  server: { port: Number(process.env.PORT ?? 8787) },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
