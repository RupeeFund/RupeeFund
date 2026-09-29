import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const pageText = (html: string): string =>
  html
    .replace(/<head[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]*>/g, " ");

describe("The name in page text", () => {
  it.each(PAGES)("never breaks across two lines on %s", (page) => {
    expect(pageText(read(page))).not.toMatch(/The[ \t\n]+Rupee[ \t\n]+Fund/);
  });
});
