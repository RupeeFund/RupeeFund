import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: "passed-only",
    projects: [
      {
        test: {
          name: "admin",
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["src/**/*.dom.test.ts"],
        },
      },
      {
        test: {
          name: "admin:dom",
          environment: "jsdom",
          include: ["src/**/*.dom.test.ts"],
        },
      },
    ],
  },
});
