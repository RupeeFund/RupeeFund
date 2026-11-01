import { getViteConfig } from "astro/config";

export default getViteConfig(
  {
    test: {
      name: "web:components",
      include: ["src/components/**/*.test.ts"],
    },
  },
  // workaround: cloudflare/workers-sdk#15969
  { configFile: false },
);
