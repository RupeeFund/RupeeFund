/// <reference lib="dom" />
// The evaluate callbacks read layout in the browser. The DOM lib stays scoped
// to the files that need it rather than widening tsconfig.node.json.
import { expect, test } from "@playwright/test";
import { readdirSync } from "node:fs";

const routes = readdirSync("src/pages")
  .filter((file) => file.endsWith(".astro"))
  .map((file) => (file === "index.astro" ? "/" : `/${file.slice(0, -6)}`));

test("every choice group stays inside the narrow form with fallback fonts", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/subscribe");
  await page.addStyleTag({ content: "fieldset { font-family: monospace; }" });
  const groups = await page.locator("fieldset").all();
  expect(groups.length).toBeGreaterThan(1);
  for (const group of groups) {
    const { legend, available, content } = await group.evaluate((fieldset) => ({
      legend: fieldset.querySelector("legend")?.textContent ?? "",
      available: fieldset.closest("form")!.clientWidth,
      content: fieldset.scrollWidth,
    }));
    expect(content, legend).toBeLessThanOrEqual(available + 1);
  }
});

const FIVE_DIGITS_PX = 48;

test("the other amount box leaves room to type at every width up to 520px", async ({ page }) => {
  await page.goto("/subscribe");
  for (let width = 320; width <= 520; width += 4) {
    await page.setViewportSize({ width, height: 900 });
    const box = await page.locator("#waitlist-amount-other").boundingBox();
    expect(box?.width ?? 0, `${width}px`).toBeGreaterThanOrEqual(FIVE_DIGITS_PX);
  }
});

for (const width of [320, 768, 1440]) {
  test(`pages fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, route).toBeLessThanOrEqual(1);
    }
  });
}

for (const width of [320, 1440]) {
  test(`every text link stays on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      const broken = await page
        .locator("a.inline-link")
        .evaluateAll((links) =>
          links.filter((a) => a.getClientRects().length > 1).map((a) => a.textContent?.trim()),
        );
      expect(broken, route).toEqual([]);
    }
  });
}

for (const width of [1024, 1440]) {
  test(`every text block at ${width}px spans the page or sits in a grid`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      const lonely = await page.locator("main :is(p, ul, ol, h1, h2)").evaluateAll((blocks) => {
        const tracks = (el: Element) =>
          getComputedStyle(el)
            .gridTemplateColumns.split(" ")
            .filter((track) => track.endsWith("px")).length;
        return blocks
          .filter((block) => {
            const wrap = block.closest<HTMLElement>(".wrap");
            const box = block.getBoundingClientRect();
            if (!wrap || box.width <= 1) return false;
            let el = block.parentElement;
            while (el && el !== wrap.parentElement) {
              if (tracks(el) > 1) return false;
              el = el.parentElement;
            }
            const pad = parseFloat(getComputedStyle(wrap).paddingInlineEnd);
            const right = wrap.getBoundingClientRect().right - pad;
            return right - box.right > (wrap.clientWidth - pad * 2) / 3;
          })
          .map((block) => block.textContent?.trim().slice(0, 40));
      });
      expect(lonely, route).toEqual([]);
    }
  });
}

for (const size of [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
]) {
  test(`the home page shows its primary action on a ${size.width} × ${size.height} screen`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    const box = await page.locator("main .btn-primary").first().boundingBox();
    expect(box?.y ?? Infinity).toBeGreaterThan(0);
    expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(size.height);
  });
}

test("/faq keeps its questions in one column across the page at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/faq");
  await page.locator("details.faq").first().locator("summary").click();
  const { edges, answer, content } = await page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>("main .wrap")!;
    const pad = parseFloat(getComputedStyle(wrap).paddingInlineStart) * 2;
    const spans = [...document.querySelectorAll("details.faq")].map((d) => {
      const box = d.getBoundingClientRect();
      return `${Math.round(box.left)}-${Math.round(box.right)}`;
    });
    return {
      edges: [...new Set(spans)],
      answer: document.querySelector(".faq-answer")!.getBoundingClientRect().width,
      content: wrap.clientWidth - pad,
    };
  });
  expect(edges).toHaveLength(1);
  expect(answer).toBeGreaterThan(content - 2);
});

const LEGAL_PAGES = ["/privacy", "/refunds"] as const;
const TALL = { width: 1280, height: 1600 };
const MAX_DEAD_SPACE_RATIO = 0.25;

test.describe("a short page ends at the footer, not a screen past it", () => {
  for (const path of LEGAL_PAGES) {
    test(`${path} scrolls only for text, never for empty space`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await page.goto(path);

      const seen = await page.evaluate(() => {
        const main = document.querySelector("main");
        const footer = document.querySelector("footer");
        const content = main?.lastElementChild?.getBoundingClientRect().bottom ?? 0;
        return {
          scrollHeight: document.documentElement.scrollHeight,
          viewport: window.innerHeight,
          gap: (footer?.getBoundingClientRect().top ?? 0) - content,
          footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
        };
      });

      // main once carried min-h-screen, so the page measured header + 100vh +
      // footer whatever the content was: it scrolled, and a whole screen of
      // nothing sat between the text and the footer. A page that fits may
      // still hold a gap, because the footer is pinned to the bottom there.
      const fits = seen.scrollHeight <= seen.viewport + 1;
      if (fits) {
        expect(seen.footerBottom, "the footer must reach the bottom of the screen").toBeGreaterThan(
          seen.viewport - 2,
        );
      } else {
        expect(seen.gap, "dead space between the text and the footer").toBeLessThan(
          seen.viewport * MAX_DEAD_SPACE_RATIO,
        );
      }
    });
  }
});
