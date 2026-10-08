import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./vitest.components.config.ts",
      {
        test: {
          name: "web:browser",
          environment: "jsdom",
          include: ["src/scripts/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "web:lib",
          include: ["src/lib/**/*.test.ts", "src/build/**/*.test.ts", "src/content/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "web:worker",
          include: ["src/worker/**/*.test.ts", "tests/*.test.ts"],
        },
      },
      {
        test: {
          name: "web:cms",
          include: ["src/plugin/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "web:deploy",
          include: ["tests/deploy/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "web:site",
          include: ["tests/site/**/*.test.ts"],
          globalSetup: ["./tests/site/build.setup.ts"],
        },
      },
    ],
  },
});
