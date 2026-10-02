import { expect, test } from "@playwright/test";

test("an empty signup marks each missing field and focuses the first", async ({ page }) => {
  await page.goto("/subscribe");
  await page.click("#waitlist-submit");

  await expect(page).toHaveURL(/\/subscribe$/);
  await expect(page.locator("#waitlist-name")).toBeFocused();
  await expect(page.locator("#waitlist-name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#waitlist-name-error")).toHaveText("Enter your full name.");
  await expect(page.locator("#waitlist-amount-error")).toHaveText("Choose a monthly amount.");
});
