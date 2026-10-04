import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    name: "site",
    include: ["tests/**/*.test.ts"],
  },
});
