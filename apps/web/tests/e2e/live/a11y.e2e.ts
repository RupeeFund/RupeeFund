import { expect, test } from "@playwright/test";

test("the skip link targets main content and is focusable", async ({ page }) => {
  await page.goto("/");
  const skip = page.locator('a[href="#main"]');
  await expect(skip).toHaveCount(1);
  await skip.focus();
  await expect(skip).toBeFocused();
});
