import { readFileSync } from "node:fs";
import type { Content } from "../../src/content/schema.ts";

export const FIXTURE: Content = JSON.parse(
  readFileSync("tests/fixtures/content/published.json", "utf8"),
);
