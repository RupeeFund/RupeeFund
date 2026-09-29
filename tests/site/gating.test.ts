import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const REMOVED_HREFS = ["/vote", "/manage", "/thank-you"] as const;

describe("no shipped page links to a page this build removed", () => {
  it("scans every built page, so a page added later needs no list update", () => {
    const links = PAGES.flatMap((page) =>
      REMOVED_HREFS.filter((href) => read(page).includes(`href="${href}"`)).map(
        (href) => `${page} -> ${href}`,
      ),
    );
    expect(PAGES.length).toBeGreaterThan(0);
    expect(links).toEqual([]);
  });
});
