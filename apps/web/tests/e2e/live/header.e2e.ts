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

test("a tap on the open phone menu's empty space keeps the menu open", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.locator("[data-menu] summary").click();
  const panel = await page.locator('nav[aria-label="Mobile"]').boundingBox();
  await page.mouse.click(panel!.x + panel!.width - 8, panel!.y + 4);
  await expect(page.locator("[data-menu]")).toHaveAttribute("open");
});

test("a tap outside the open phone menu closes it", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.locator("[data-menu] summary").click();
  await page.mouse.click(180, 600);
  await expect(page.locator("[data-menu]")).not.toHaveAttribute("open");
  await expect(page).toHaveURL("/");
});

test("each phone menu link fills its row", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.locator("[data-menu] summary").click();
  const nav = page.locator('nav[aria-label="Mobile"]');
  const inner = await nav.evaluate((el) => {
    const style = getComputedStyle(el);
    return el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  });
  for (const link of await nav.locator("a.nav-link").all()) {
    expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(inner);
  }
});
