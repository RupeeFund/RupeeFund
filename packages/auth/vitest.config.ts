import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "auth",
    fsModuleCachePath: fileURLToPath(new URL("./node_modules/.vitest-cache", import.meta.url).href),
    include: ["src/**/*.test.ts"],
  },
});
