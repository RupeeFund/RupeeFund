import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "auth",
    fsModuleCachePath: fileURLToPath(new URL("./node_modules/.vitest-cache", import.meta.url).href),
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: { statements: 96, branches: 96, functions: 96, lines: 97 },
    },
  },
});
