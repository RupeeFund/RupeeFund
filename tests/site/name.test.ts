import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const pageText = (html: string): string =>
  html
    .replace(/<head[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]*>/g, " ");

describe("The name in page text", () => {
  it.each(PAGES)("never breaks across two lines on %s", (page) => {
    const gaps = [...pageText(read(page)).matchAll(/The(.{1,8}?)Rupee(.{1,8}?)Fund/gs)].flatMap(
      ([, first, second]) => [first, second],
    );
    expect(gaps.filter((gap) => !/^(&nbsp;|&#160;|\u00a0)$/.test(gap))).toEqual([]);
  });
});
