/// <reference lib="dom" />
// The evaluate callbacks read layout in the browser. The DOM lib stays scoped
// to the files that need it rather than widening tsconfig.node.json.
import { expect, test } from "@playwright/test";
import { pages, posts, routes } from "../routes.ts";

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

test("the home page fits every viewport from 320px to 1920px", async ({ page }) => {
  await page.goto("/");
  for (let width = 320; width <= 1920; width += 8) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
  }
});

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

for (const width of [360, 1024, 1180, 1440]) {
  test(`the home page name stays inside its column at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const { text, column } = await page.locator("main h1").evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return { text: range.getBoundingClientRect().width, column: el.clientWidth };
    });
    expect(text).toBeLessThanOrEqual(column);
  });
}

test("each home section fits one 360 × 640 phone screen below the header", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  const { room, sections } = await page.evaluate(() => ({
    room: innerHeight - document.querySelector("header")!.getBoundingClientRect().height,
    sections: [...document.querySelectorAll("main section")].map((el) => ({
      title: el.querySelector("h1, h2")?.textContent?.trim() ?? "",
      height: el.getBoundingClientRect().height,
    })),
  }));
  expect(sections.length).toBeGreaterThan(6);
  for (const { title, height } of sections) expect(height, title).toBeLessThanOrEqual(room);
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

test("each post image keeps its shape before the file loads", async ({ page }) => {
  await page.route(/\.(avif|webp|png|jpe?g)(\?|$)|\/_image\?|\/media\//, () => {});
  let images = 0;
  for (const viewport of [
    { width: 360, height: 900 },
    { width: 1440, height: 500 },
  ]) {
    await page.setViewportSize(viewport);
    for (const post of posts) {
      await page.goto(post, { waitUntil: "domcontentloaded" });
      for (const image of await page.locator(".prose img").all()) {
        images += 1;
        const { width, height } = (await image.boundingBox())!;
        const natural = Number(await image.getAttribute("width"));
        const ratio = natural / Number(await image.getAttribute("height"));
        expect(height, post).toBeGreaterThan(0);
        expect(width, post).toBeLessThanOrEqual(natural);
        expect(height, post).toBeLessThanOrEqual(viewport.height * 0.8 + 1);
        expect(width / height, post).toBeCloseTo(ratio, 1);
      }
    }
  }
  expect(images).toBeGreaterThan(0);
});

test("a page title with one long word still fits a 320px screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const route of [posts[0]!, pages[0]!]) {
    await page.goto(route);
    const overflow = await page.evaluate(() => {
      document.querySelector("main h1")!.textContent = "Internationalisation of microcontributions";
      return document.documentElement.scrollWidth - innerWidth;
    });
    expect(overflow, route).toBeLessThanOrEqual(1);
  }
});
