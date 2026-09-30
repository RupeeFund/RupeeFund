import { expect, test } from "@playwright/test";

test("the header button shows only its icon while the hero button is in view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const cta = page.locator("[data-header-cta]");
  await expect(cta).toHaveAttribute("data-compact");

  await page.mouse.wheel(0, 900);
  await expect(cta).not.toHaveAttribute("data-compact");

  await page.mouse.wheel(0, -900);
  await expect(cta).toHaveAttribute("data-compact");
});

test("Tab right after Enter on the phone menu lands on its first link", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.locator("[data-menu] summary").focus();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");

  await expect(page.locator('nav[aria-label="Mobile"] a').first()).toBeFocused();
});
