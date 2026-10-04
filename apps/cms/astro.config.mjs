import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import emdash from "emdash/astro";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB" }),
      storage: r2({ binding: "MEDIA" }),
      plugins: [
        {
          id: "rupeefund-site",
          version: "1.0.0",
          format: "native",
          entrypoint: "@rupeefund/cms/plugin",
        },
      ],
    }),
  ],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    define: {
      "import.meta.env.EMDASH_PREVIEW_PATH_PATTERN": JSON.stringify("/preview/{collection}/{id}"),
    },
  },
});
