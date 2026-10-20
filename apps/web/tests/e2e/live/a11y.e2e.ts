import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { posts, routes } from "../routes.ts";

test("the skip link targets main content and is focusable", async ({ page }) => {
  await page.goto("/");
  const skip = page.locator('a[href="#main"]');
  await expect(skip).toHaveCount(1);
  await skip.focus();
  await expect(skip).toBeFocused();
});

test("the sign-up card button shows an ink focus ring", async ({ page }) => {
  await page.goto(posts[0]!);
  const button = page.locator('aside[aria-labelledby="signup-title"] a');
  await button.focus();
  await expect(button).toHaveCSS("outline-color", "rgb(20, 20, 20)");
});

test("the footer email link reads as one address", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('footer a[href^="mailto:"]')).toHaveAttribute(
    "aria-label",
    "rupeefund@fossunited.org",
  );
});

test("each team profile link says it opens in a new tab", async ({ page }) => {
  await page.goto("/people");
  const profiles = page.locator('main article h3 + a[target="_blank"]');
  await expect(profiles.first()).toBeVisible();
  for (const label of await profiles.evaluateAll((links) =>
    links.map((link) => link.getAttribute("aria-label")),
  )) {
    expect(label).toMatch(/ \(opens in a new tab\)$/);
  }
});

test("the sign-up form takes its name from the page heading", async ({ page }) => {
  await page.goto("/subscribe");
  await expect(page.getByRole("form", { name: "I am interested!" })).toHaveCount(1);
});

test("each team profile link is at least 24 px tall on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/people");
  const profiles = page.locator('main article h3 + a[target="_blank"]');
  await expect(profiles.first()).toBeVisible();
  for (const box of await profiles.evaluateAll((links) =>
    links.map((link) => link.getBoundingClientRect().height),
  )) {
    expect(box).toBeGreaterThanOrEqual(24);
  }
});

test("forced colors keep the new-tab arrow, the card edge and the step line", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/people");
  const arrow = await page
    .locator('main a[target="_blank"]')
    .first()
    .evaluate((link) => getComputedStyle(link, "::after").backgroundImage);
  expect(arrow).not.toBe("none");
  await expect(page.locator(".card").first()).not.toHaveCSS("border-top-width", "0px");
  await page.goto("/");
  const line = await page
    .locator(".step")
    .first()
    .evaluate((step) => getComputedStyle(step, "::before").backgroundColor);
  expect(line).toBe(await page.evaluate(() => getComputedStyle(document.body).color));
});

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const route of routes) {
  test(`${route} passes the WCAG 2.2 AA axe rules at 360 and 1440px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      expect(
        violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target).join(", ")}`),
        `${width}px`,
      ).toEqual([]);
    }
  });
}
