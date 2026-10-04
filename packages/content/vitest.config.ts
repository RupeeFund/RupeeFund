import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "content",
    include: ["tests/**/*.test.ts"],
  },
});
