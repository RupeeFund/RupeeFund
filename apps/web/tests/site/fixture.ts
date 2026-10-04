import { readFileSync } from "node:fs";
import type { Content } from "@rupeefund/content/schema";

export const FIXTURE: Content = JSON.parse(
  readFileSync("tests/fixtures/content/published.json", "utf8"),
);
