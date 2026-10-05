// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const pageText = (html: string): string => {
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const script of document.querySelectorAll("script")) script.remove();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? "");
  return parts.join(" ");
};

describe("The name in page text", () => {
  it.each(PAGES)("never breaks across two lines on %s", (page) => {
    const gaps = [...pageText(read(page)).matchAll(/The(.{1,8}?)Rupee(.{1,8}?)Fund/gs)].flatMap(
      ([, first, second]) => [first, second],
    );
    expect(gaps.filter((gap) => !/^(&nbsp;|&#160;|\u00a0)$/.test(gap))).toEqual([]);
  });
});
