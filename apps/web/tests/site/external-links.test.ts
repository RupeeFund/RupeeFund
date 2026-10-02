import { describe, expect, it } from "vitest";
import { PAGES, read, styles } from "./dist.ts";

const OWN_ORIGIN = "https://rupeefund.org";

interface Anchor {
  page: string;
  href: string;
  tag: string;
}

function anchors(): Anchor[] {
  const found: Anchor[] = [];
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/<a\s[^>]*>/g)) {
      const tag = m[0];
      const href = /\shref="([^"]*)"/.exec(tag)?.[1];
      if (href !== undefined) found.push({ page, href, tag });
    }
  }
  return found;
}

const ANCHORS = anchors();

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href) && new URL(href).origin !== OWN_ORIGIN;
}

describe('the external-link arrow is painted from `target="_blank"`, so that attribute must mark every external link and nothing else', () => {
  const external = ANCHORS.filter((a) => isExternal(a.href));

  it("gives every external link the attribute the arrow is drawn from, and `noopener`", () => {
    expect(external.length).toBeGreaterThan(10);
    for (const a of external) {
      expect(a.tag, `${a.page} → ${a.href}`).toContain('target="_blank"');
      expect(a.tag, `${a.page} → ${a.href}`).toContain("noopener");
    }
  });

  it("marks nothing else — no internal or mailto link claims `_blank`", () => {
    for (const a of ANCHORS.filter((x) => x.tag.includes('target="_blank"'))) {
      expect(isExternal(a.href), `${a.page} → ${a.href} is not external`).toBe(true);
    }
  });
});

const OPTED_OUT = new Set([
  "https://x.com/fossunited",
  "https://mas.to/@fossunited",
  "https://in.linkedin.com/company/fossunited",
  "https://www.youtube.com/c/fossunited",
  "https://t.me/fossunited",
]);

describe("`.link-plain` drops both the arrow and the new-tab announcement, so only the footer social row may carry it", () => {
  const plain = ANCHORS.filter((a) => /\sclass="[^"]*\blink-plain\b/.test(a.tag));

  it("opts out no link beyond the footer social row", () => {
    for (const a of plain) {
      expect(OPTED_OUT.has(a.href), `${a.page} → ${a.href} may not opt out`).toBe(true);
    }
  });

  it("opts out the same five social links on every page, and no more", () => {
    for (const page of PAGES) {
      const onPage = plain.filter((a) => a.page === page);
      expect(onPage.length, `${page} opts out ${onPage.length} links`).toBe(5);
    }
  });
});

describe("the compiled arrow rule keeps what the browser test cannot see", () => {
  const css = styles().replace(/\s*([{};:,])\s*/g, "$1");
  const rule = /a\[target=["']?_blank["']?\]:not\(\.link-plain\):{1,2}after\{([^}]*)\}/.exec(css);

  it("holds a no-break space, which is what binds the arrow to the last word", () => {
    expect(rule?.[1]).toContain("\u00a0");
  });

  it("paints colour only inside the mask tile, because WebKit leaves an inline box unmasked outside it", () => {
    expect(rule?.[1]).toContain("mask-image");
    expect(rule?.[1]).not.toContain("background-color");
  });
});
