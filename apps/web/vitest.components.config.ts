import { getViteConfig } from "astro/config";

export default getViteConfig(
  {
    test: {
      name: "web:components",
      include: ["src/components/**/*.test.ts"],
    },
  },
  { configFile: false },
);
