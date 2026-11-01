import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "db",
    fsModuleCachePath: fileURLToPath(new URL("./node_modules/.vitest-cache", import.meta.url).href),
    include: ["tests/**/*.test.ts"],
  },
});
